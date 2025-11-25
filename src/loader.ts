import * as vscode from 'vscode';
import { IServerSpec } from "@intersystems-community/intersystems-servermanager";
import { makeRESTRequest, resolveCredentials } from './makeRESTRequest';
import { extensionId, mapLoaders, extensionUri, serverManagerApi } from './extension';
import { AxiosResponse } from 'axios';

export class Loader extends vscode.Disposable {
    public serverId: string;
    public namespace: string;

    private _disposables: vscode.Disposable[] = [];
    private _serverSpec: IServerSpec | undefined;
    private _panel: vscode.WebviewPanel | undefined;

    constructor(serverId: string, namespace: string) {
        super(() => {
            this.dispose();
        });
        this.serverId = serverId;
        this.namespace = namespace;
    }

    public async initialize(serverSpec?: IServerSpec): Promise<string> {
        let response: AxiosResponse | undefined;
        if (!extensionUri) {
            return "Error: ourAssetPath is not set.";
        }
        if (!serverSpec) {
            serverSpec = await serverManagerApi.getServerSpec(this.serverId);
            if (!serverSpec) {
                return `Server definition '${this.serverId}' not found.`;
            }

            // Always resolve credentials in case any of the endpoints we use require them.
            await resolveCredentials(serverSpec);
        }
        this._serverSpec = serverSpec;

		const dataFiles = await vscode.workspace.fs.readDirectory(this.serverFolder());

        response = await makeRESTRequest(
            "POST",
            this._serverSpec,
            { apiVersion: 1, namespace: this.namespace, path: "/action/query" },
            { query: "select TABLE_SCHEMA as SchemaName, COUNT(*) as NumberOfTables from INFORMATION_SCHEMA.TABLES where TABLE_TYPE='BASE TABLE' group by TABLE_SCHEMA" }
        );
        if (!response) {
            return `Failed to query server '${this.serverId}' SQL schemata for namespace ${this.namespace}.`;
        }
        if (response?.status !== 200) {
            return `Failed to query server '${this.serverId}' SQL schemata for namespace ${this.namespace}. Status: ${response?.status}`;
        }
        const schemata = response.data?.result?.content;
        if (!schemata.length) {
            return `No SQL schemata available on server '${this.serverId}' in namespace ${this.namespace}.`;
        }

        // Create and show a new webview
        const assetsUri = vscode.Uri.joinPath(extensionUri, "assets");
        const nodeModulesUri = vscode.Uri.joinPath(extensionUri, "node_modules");
        const panel = vscode.window.createWebviewPanel(
            `${extensionId}.loader`,
            `Data Loader - ${this.namespace} on ${this.serverId}`,
            vscode.ViewColumn.Active,
            {
                localResourceRoots: [assetsUri, nodeModulesUri],
                retainContextWhenHidden: true, // Keep the page when its tab is not visible, otherwise it will be reloaded when the tab is revisited.
                enableScripts: true,
                //enableFindWidget: true,
            }
        );
        panel.onDidDispose(
            () => {
                this.dispose();
            },
            null,
            this._disposables
        );
        panel.iconPath = vscode.Uri.joinPath(assetsUri, "fileIcon.svg");
        this._panel = panel;

        const webview = panel.webview;
        webview.onDidReceiveMessage(
            async (message) => {
				let schema: string;
				let table: string;
                switch (message.command) {
                    case "ready":
                        webview.postMessage({
                            command: "load",
                            serverSpec: this._serverSpec,
                            namespace: this.namespace,
                            schemata,
                        });
                        return;
                    case "schemaChanged":
						if (!this._serverSpec) {
							return;
						}
                        schema = message.schema;
						response = await makeRESTRequest(
							"POST",
							this._serverSpec,
							{ apiVersion: 1, namespace: this.namespace, path: "/action/query" },
							{
								query: `select TABLE_NAME as TableName, DESCRIPTION as Description from INFORMATION_SCHEMA.TABLES where TABLE_SCHEMA=?`,
								parameters: [ schema ],
							},
						);
						if (!response) {
							return;
						}
						if (response?.status !== 200) {
							return;
						}
						const tables = response.data?.result?.content || [];
						webview.postMessage({
							command: "tables",
							schema,
							tables,
						});
						return;
                    case "tableChanged":
						if (!this._serverSpec) {
							return;
						}
                        schema = message.schema;
                        table = message.table;
						response = await makeRESTRequest(
							"POST",
							this._serverSpec,
							{ apiVersion: 1, namespace: this.namespace, path: "/action/query" },
							{
								query: `select COLUMN_NAME as ColumnName, DATA_TYPE as DataType, DESCRIPTION as Description from INFORMATION_SCHEMA.COLUMNS where TABLE_SCHEMA=? and TABLE_NAME=? order by ORDINAL_POSITION`,
								parameters: [ schema, table ],
							},
						);
						if (!response) {
							return;
						}
						if (response?.status !== 200) {
							return;
						}
						const columns = response.data?.result?.content || [];
						webview.postMessage({
							command: "columns",
							schema,
							table,
							columns,
						});
						return;
					case "uploadFile":
						const file = await vscode.window.showOpenDialog({
							canSelectMany: false,
							openLabel: 'Select data file to upload',
						});
						if (!file || file.length === 0) {
							return;
						}
						const fileUri = file[0];
						const fileData = await vscode.workspace.fs.readFile(fileUri);
						const fileName = fileUri.path.split('/').pop();
						if (!fileName) {
							return;
						}
						const destinationUri = vscode.Uri.joinPath(this.serverFolder(), fileName);
						if (await vscode.workspace.fs.stat(destinationUri)) {
							const overwrite = await vscode.window.showWarningMessage(
								`File '${fileName}' already exists on server '${this.serverId}' for namespace '${this.namespace}'. Overwrite?`,
								{ modal: true, },
								{ title: 'Yes' },
								{ title: 'No', isCloseAffordance: true },
							);
							if (overwrite?.title !== 'Yes') {
								return;
							}
						}
						await vscode.workspace.fs.writeFile(
							destinationUri,
							fileData
						);
						vscode.window.showInformationMessage(`Uploaded file '${fileName}' to server '${this.serverId}' for namespace '${this.namespace}'.`);
						return;
                }
            },
            undefined,
            this._disposables
        );

        // We are using VSCode Elements (see https://vscode-elements.github.io/)

        const repoName = "dummy";
        let repoRows: any[] = [];

        const html =
`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>DataLoader</title>
    <link
      rel="stylesheet"
      href="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          nodeModulesUri,
          "@vscode",
          "codicons",
          "dist",
          "codicon.css"
        )
      )}"
      id="vscode-codicon-stylesheet"
    />
  </head>
  <body>
    <p>
	<vscode-label for="selectSchema">Schema:</vscode-label>
	<vscode-single-select id="selectSchema" combobox>`
+	schemata.map((schema: any) => `
		<vscode-option description="Table count: ${schema.NumberOfTables}">${schema.SchemaName}</vscode-option>`
	).join("")
+ `
	</vscode-single-select>
	</p>
    <p>
	<vscode-label for="selectTable">Table:</vscode-label>
	<vscode-single-select id="selectTable" combobox>
	</vscode-single-select>
	</p>

    <p>
    <vscode-collapsible title="Columns" description="Structure of selected table" open>
        <vscode-table id="tblColumns" zebra bordered-columns resizable columns='["25%", "15%", "60%"]'>
          <vscode-table-header slot="header">
            <vscode-table-header-cell>Name</vscode-table-header-cell>
            <vscode-table-header-cell>DataType</vscode-table-header-cell>
            <vscode-table-header-cell>Description</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body slot="body">`
+ `
          </vscode-table-body>
        </vscode-table>
    </vscode-collapsible>
    </p>

	<p>
    <vscode-collapsible title="Available Files" description="Data files uploaded to server" open>
        <vscode-table zebra bordered-columns resizable columns='["95%", "5%"]'>
          <vscode-table-header slot="header">
            <vscode-table-header-cell>Name</vscode-table-header-cell>
            <vscode-table-header-cell>Actions</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body slot="body">`
+   (dataFiles?.length > 0
        ? dataFiles
            .map(dataFile => `
            <vscode-table-row>
              <vscode-table-cell>${dataFile[0]}</vscode-table-cell>
              <vscode-table-cell><vscode-icon class="btnDeleteFile" name="trash" action-icon title="${dataFile[0]}" data-fileName="${dataFile[0]}"></vscode-icon></vscode-table-cell>
            </vscode-table-row>`
            )
            .join("")
        : ""
    )
+ `
        </vscode-table>
        <vscode-divider></vscode-divider>
		<vscode-button id="cmdUploadFile" title="Choose a local file and upload it to the server">Upload New File to Server</vscode-button>
		`
+ `
    </vscode-collapsible>
    </p>

    <script
      src="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          nodeModulesUri,
          "@vscode-elements",
          "elements",
          "dist",
          "bundled.js"
        )
      )}"
      type="module"
    ></script>
    <script
      src="${webview.asWebviewUri(
        vscode.Uri.joinPath(assetsUri, "loaderScript.js")
      )}"
      type="module"
    ></script>
  </body>
</html>`;

        webview.html = html;
        return "";
    }

	public serverFolder(): vscode.Uri {
		return vscode.Uri.from({ scheme: "isfs", authority: `${this.serverId}:%sys`, path: `/_vscode/${this.namespace}/DataLoader`, query: "csp" });
	}

    public show() {
        if (this._panel) {
            this._panel.reveal();
        }
    }

    dispose() {
        this._disposables.forEach((d) => d.dispose());
        mapLoaders.delete(`${this.serverId}:${this.namespace}`);
    }
}
