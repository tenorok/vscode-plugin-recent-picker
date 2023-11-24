import * as vscode from 'vscode';
import * as path from 'path';
import FixedUniqArray from './FixedUniqArray';
import WorkspaceFolders from './WorkspaceFolders';

const FOLDER_NAME_SEPARATOR = ' • ';

const config = vscode.workspace.getConfiguration('recent-picker');

const recentList = new FixedUniqArray<string>(
    // One extra item for current file.
    config.get<number>('length', 30) + 1,
);

const workspaceFolders = new WorkspaceFolders();

export function activate(context: vscode.ExtensionContext) {
    const activeFileName = getActiveFileName();
    if (activeFileName) {
        recentList.push(activeFileName);
    }

    workspaceFolders.add(vscode.workspace.workspaceFolders);

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
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(onChangeWorkspaceFolders),
    );
}

export function deactivate() {
    recentList.destructor();
    workspaceFolders.destructor();
}

function getActiveFileName() {
    return vscode.window.activeTextEditor?.document.fileName;
}

async function onOpen() {
    const activeFileName = getActiveFileName();
    const list = recentList.get();
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
    const folderInfo = workspaceFolders.getFolderByFileName(fileName);

    if (folderInfo) {
        const prefix = getPickerItemPrefix(folderInfo.name);

        if (prefix !== null) {
            const relativeFileName = path.relative(folderInfo.path, fileName);
            return `${prefix}${relativeFileName}`;
        }
    }

    return fileName;
}

function getPickerItemPrefix(folderName: string): string | null {
    if (workspaceFolders.getTotalFoldersCount() === 1) {
        // For files in single folder not needed prefix.
        return '';
    }

    if (workspaceFolders.getFolderNameCount(folderName) === 1) {
        // For unique name of folder returns beautiful prefix.
        return folderName + FOLDER_NAME_SEPARATOR;
    }

    // For files from few folders with same names used just full path.
    return null;
}

function getAbsFileName(pickerItem: string) {
    if (pickerItem.includes(FOLDER_NAME_SEPARATOR)) {
        // Case when pickerItem is unique folder name and relative file path.
        const [folderName, relativeFileName] = pickerItem.split(
            FOLDER_NAME_SEPARATOR,
        );
        const folderInfo = workspaceFolders.findFolderByName(folderName);
        if (folderInfo) {
            return path.resolve(folderInfo.path, relativeFileName);
        }
    } else if (!path.isAbsolute(pickerItem)) {
        // Case when pickerItem is only relative file path.
        // It's correct even if later was added second folder.
        const folderInfo = workspaceFolders.getFolders()[0];
        return path.resolve(folderInfo.path, pickerItem);
    }

    // Case when pickedItem is absolutely file path or other unforeseen cases.
    return pickerItem;
}

function onChangeActiveTextEditor(e?: vscode.TextEditor) {
    if (!e) {
        return;
    }

    recentList.push(e.document.fileName);
}

function onDeleteFiles(e: vscode.FileDeleteEvent) {
    for (const { scheme, path } of e.files) {
        if (scheme !== 'file') {
            continue;
        }

        recentList.delete(path);
    }
}

function onRenameFiles(e: vscode.FileRenameEvent) {
    for (const { oldUri, newUri } of e.files) {
        if (oldUri.scheme !== 'file') {
            continue;
        }

        recentList.replace(oldUri.path, newUri.path);
    }
}

function onChangeWorkspaceFolders(e: vscode.WorkspaceFoldersChangeEvent) {
    const { added, removed } = e;

    for (const removedFolder of removed) {
        for (const fileName of recentList.get()) {
            const folderInfo = workspaceFolders.getFolderByFileName(fileName);
            if (!folderInfo) {
                continue;
            }

            if (removedFolder.uri.path === folderInfo.path) {
                // Removes files which belong to removed folder.
                recentList.delete(fileName);
            }
        }
    }

    workspaceFolders.add(added);
    workspaceFolders.remove(removed);
}

async function onPickFile(relativeFileName: string) {
    try {
        const document = await vscode.workspace.openTextDocument(
            getAbsFileName(relativeFileName),
        );
        await vscode.window.showTextDocument(document);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(message);
    }
}
