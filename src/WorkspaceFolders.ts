import * as vscode from 'vscode';

interface IFolder {
    index: number;
    name: string;
    path: string;
}

type TFolderPath = string;

type TFolderName = string;

export default class WorkspaceFolders {
    private folders = new Map<TFolderPath, IFolder>();
    private countByName = new Map<TFolderName, number>();

    public add(folders: readonly vscode.WorkspaceFolder[] = []): void {
        for (const folder of folders) {
            this.folders.set(folder.uri.path, {
                index: folder.index,
                name: folder.name,
                path: folder.uri.path,
            });

            const count = this.countByName.get(folder.name);
            if (count) {
                this.countByName.set(folder.name, count + 1);
            } else {
                this.countByName.set(folder.name, 1);
            }
        }
    }

    public remove(folders: readonly vscode.WorkspaceFolder[]): void {
        for (const folder of folders) {
            this.folders.delete(folder.uri.path);

            const count = this.countByName.get(folder.name);
            if (count && count > 1) {
                this.countByName.set(folder.name, count - 1);
            } else {
                this.countByName.delete(folder.name);
            }
        }
    }

    /**
     * Find folder inside which there is a file.
     */
    public getFolderByFileName(fileName: string): IFolder | null {
        for (const [, folder] of this.folders) {
            if (fileName.startsWith(folder.path)) {
                return folder;
            }
        }

        return null;
    }

    public findFolderByName(name: string): IFolder | null {
        // Find first folder with specified name.
        // It's correct even if later was added second folder with the same name.
        for (const [, folder] of this.folders) {
            if (folder.name === name) {
                return folder;
            }
        }

        return null;
    }

    /**
     * Workspace can have a few folders with same names.
     */
    public getFolderNameCount(name: string): number {
        return this.countByName.get(name) ?? 0;
    }

    public getTotalFoldersCount(): number {
        return this.folders.size;
    }

    public getFolders(): IFolder[] {
        return Array.from(this.folders.values());
    }

    public destructor() {
        this.folders.clear();
        this.countByName.clear();
    }
}
