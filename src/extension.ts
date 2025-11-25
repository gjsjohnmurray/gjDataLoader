/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { Loader } from './loader';
//import { makeRESTRequest } from './makeRESTRequest';

interface IHosts {
	[key: string]: { enabled: boolean };
}

export const extensionId = "georgejames.data-loader";

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;
export let jsonUri: vscode.Uri;

// Map to limit to one loader per server:namespace
export const mapLoaders: Map<string, Loader> = new Map<string, Loader>();

export let serverManagerApi: serverManager.ServerManagerAPI;

export async function activate(context: vscode.ExtensionContext) {

	extensionUri = context.extensionUri;
	jsonUri = context.globalStorageUri;
	await vscode.workspace.fs.createDirectory(jsonUri);
	jsonUri = jsonUri.with({ path: jsonUri.path + '/workspace.json' });
	logChannel = vscode.window.createOutputChannel('gj :: configExplorer', { log: true});
	logChannel.info('Extension activated');
	logChannel.debug(`JSON file will be written at ${jsonUri.fsPath}`);

	const serverManagerExt = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
	if (!serverManagerExt) {
		throw new Error('Server Manager extension not installed');
	}
	if (!serverManagerExt.isActive) {
	  await serverManagerExt.activate();
	}
    serverManagerApi = serverManagerExt.exports;

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionId}.intersystems-servermanager`, async (serverTreeItem) => {
			logChannel.debug('Command invoked from intersystems-servermanager');
			const idArray: string[] = serverTreeItem.id.split(':');
			const serverId = idArray[1];
			const namespace = idArray[3];
			const keyInMap = `${serverId}:${namespace}`;
			let loader = mapLoaders.get(keyInMap);
			if (loader) {
				loader.show();
				return;
			}

			loader = new Loader(serverId, namespace);
			const errorText = await loader.initialize();
			if (errorText) {
				vscode.window.showErrorMessage(errorText);
				return;
			}

			mapLoaders.set(keyInMap, loader);
			context.subscriptions.push(loader);
		})
	);
}

export function deactivate() {
	logChannel.debug('Extension deactivated');
}
