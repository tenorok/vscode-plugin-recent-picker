import * as vscode from 'vscode';
import * as path from 'path';
import FixedUniqArray from './FixedUniqArray';

const RECENT_LENGTH = 3;

// One extra item for current file.
const fixedUniqArray = new FixedUniqArray<string>(RECENT_LENGTH + 1);

export function activate(context: vscode.ExtensionContext) {
    const activeFileName = getActiveFileName();
    if (activeFileName) {
        fixedUniqArray.push(activeFileName);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('recent-picker.open', onOpen),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onChangeActiveTextEditor),
    );
    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles(onDeleteFiles),
    );
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(onRenameFiles),
    );
}

export function deactivate() {
    fixedUniqArray.destructor();
}

function getActiveFileName() {
    return vscode.window.activeTextEditor?.document.fileName;
}

async function onOpen() {
    const activeFileName = getActiveFileName();
    const list = fixedUniqArray.get();
    const lastIndex = activeFileName ? 0 : 1;
    const recent = [];

    for (let i = list.length - 1; i >= lastIndex; i--) {
        const item = list[i];
        if (item === activeFileName) {
            continue;
        }

        recent.push(getPickerItem(item));
    }

    const relativeFileName = await vscode.window.showQuickPick(recent);
    if (relativeFileName) {
        onPickFile(relativeFileName);
    }
}

function getPickerItem(fileName: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length === 1) {
        // Resolve relative path to file for single workspace.
        return path.relative(workspaceFolders[0].uri.path, fileName);
    }

    return fileName;
}

function getAbsFileName(relativeFileName: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length === 1) {
        // Resolve absolute path from relative to file when using single workspace.
        return path.resolve(workspaceFolders[0].uri.path, relativeFileName);
    }

    return relativeFileName;
}

function onChangeActiveTextEditor(e?: vscode.TextEditor) {
    if (!e) {
        return;
    }

    fixedUniqArray.push(e.document.fileName);
}

function onDeleteFiles(e: vscode.FileDeleteEvent) {
    for (const { scheme, path } of e.files) {
        if (scheme !== 'file') {
            continue;
        }

        fixedUniqArray.delete(path);
    }
}

function onRenameFiles(e: vscode.FileRenameEvent) {
    for (const { oldUri, newUri } of e.files) {
        if (oldUri.scheme !== 'file') {
            continue;
        }

        fixedUniqArray.replace(oldUri.path, newUri.path);
    }
}

async function onPickFile(relativeFileName: string) {
    try {
        const document = await vscode.workspace.openTextDocument(
            getAbsFileName(relativeFileName),
        );
        await vscode.window.showTextDocument(document);
    } catch (err) {
        const message = err instanceof Error ? err.message : (err as string);
        vscode.window.showErrorMessage(message);
    }
}
