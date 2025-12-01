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
	private _serverFolderPath: string = "";

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
        response = await makeRESTRequest(
            "POST",
            this._serverSpec,
            { apiVersion: 1, namespace: "%SYS", path: "/action/query" },
            { query: "CALL Security.Applications_Detail('/_vscode',2)" }
        );
        if (!response) {
            return `Failed to query server '${this.serverId}' for /_vscode web application.`;
        }
        if (response?.status !== 200) {
            return `Failed to query server '${this.serverId}'  for /_vscode web application. Status: ${response?.status}`;
        }
        const appDetails = response.data?.result?.content;
        if (appDetails[0]?.Name !== '/_vscode') {
            return `No /_vscode web application available on server '${this.serverId}'.`;
        }
		this._serverFolderPath = `${appDetails[0].Path}/${this.namespace}/DataLoader/`;

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
				let destinationUri: vscode.Uri;
				let fileName: string;
                switch (message.command) {
                    case "ready":
                        webview.postMessage({
                            command: "load",
                            serverSpec: this._serverSpec,
                            namespace: this.namespace,
                            schemata,
                        });
                        webview.postMessage({
                            command: "dataFiles",
							dataFiles: await vscode.workspace.fs.readDirectory(this.serverFolderUri()),
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
								query: `select COLUMN_NAME as ColumnName, DATA_TYPE as DataType, DESCRIPTION as Description, IS_NULLABLE as IsNullable, IS_GENERATED as IsGenerated, IS_UPDATABLE as IsUpdatable, IS_IDENTITY as IsIdentity, AUTO_INCREMENT as IsAutoIncrement, UNIQUE_COLUMN as IsUnique, PRIMARY_KEY as IsPrimaryKey from INFORMATION_SCHEMA.COLUMNS where TABLE_SCHEMA=? and TABLE_NAME=? order by ORDINAL_POSITION`,
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
					case "selectFile":
						fileName = message.fileName;
						// TODO
						return;
					case "previewFile":
						fileName = message.fileName;
						destinationUri = vscode.Uri.joinPath(this.serverFolderUri(), fileName);
						try {
							const previewData = await vscode.workspace.fs.readFile(destinationUri);
							const previewText = new TextDecoder().decode(previewData);
							const previewLines = previewText.split(/\r?\n/).slice(0, 10).join('\n');
							webview.postMessage({
								command: "filePreview",
								fileName,
								previewLines,
							});
						} catch (_error) {
							// File does not exist, continue
						}
						return;
					case "deleteFile":
						fileName = message.fileName;
						destinationUri = vscode.Uri.joinPath(this.serverFolderUri(), fileName);
						try {
							if (await vscode.workspace.fs.stat(destinationUri)) {
								const ok = await vscode.window.showWarningMessage(
									`Delete '${fileName}' from server '${this.serverId}' for namespace '${this.namespace}'?`,
									{ modal: true, },
									{ title: 'Yes' },
									{ title: 'No', isCloseAffordance: true },
								);
								if (ok?.title !== 'Yes') {
									return;
								}
							}
							await vscode.workspace.fs.delete(destinationUri);
							vscode.window.showInformationMessage(`Deleted file '${fileName}' from server '${this.serverId}' for namespace '${this.namespace}'.`);
							webview.postMessage({
								command: "dataFiles",
								dataFiles: await vscode.workspace.fs.readDirectory(this.serverFolderUri()),
							});
						} catch (_error) {
							// File does not exist, continue
						}
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
						fileName = fileUri.path.split('/').pop() || "";
						if (!fileName) {
							return;
						}
						destinationUri = vscode.Uri.joinPath(this.serverFolderUri(), fileName);
						try {
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

						} catch (_error) {
							// File does not exist, continue
						}

						await vscode.workspace.fs.writeFile(
							destinationUri,
							fileData
						);
						vscode.window.showInformationMessage(`Uploaded file '${fileName}' to server '${this.serverId}' for namespace '${this.namespace}'.`);
						webview.postMessage({
                            command: "dataFiles",
							dataFiles: await vscode.workspace.fs.readDirectory(this.serverFolderUri()),
                        });
						return;
					case "refreshFileList":
						webview.postMessage({
                            command: "dataFiles",
							dataFiles: await vscode.workspace.fs.readDirectory(this.serverFolderUri()),
                        });
						return;
					case "showErrorMessage":
						vscode.window.showErrorMessage(message.text);
						return;
                    case "loadData":
						if (!this._serverSpec) {
							return;
						}
                        schema = message.schema;
                        table = message.table;
                        fileName = this.serverFolderPath() + message.fileName;
						const columnList = message.columnList;
						const loadOptionList = message.loadOptionList;
						const strJsonOptions = JSON.stringify(message.jsonOptions || "{}");
						response = await makeRESTRequest(
							"POST",
							this._serverSpec,
							{ apiVersion: 1, namespace: this.namespace, path: "/action/query" },
							{
								query: `LOAD ${loadOptionList} DATA FROM FILE '${fileName}' INTO ${schema}.${table} (${columnList}) USING '${strJsonOptions}'`,
							},
						);
						if (!response) {
							vscode.window.showErrorMessage(`Failed to load data from file '${fileName}' into ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'.`);
							return;
						}
						if (response?.status !== 200) {
							vscode.window.showErrorMessage(`Failed to load data from file '${fileName}' into ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'. Status: ${response?.status}`);
							return;
						}
						vscode.window.showInformationMessage(`Loaded data from file '${fileName}' into ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'.`);
						return;
                    case "truncateTable":
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
								query: `SELECT COUNT(*) FROM ${schema}.${table}`,
							},
						);
						if (!response) {
							vscode.window.showErrorMessage(`Failed to count records in ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'.`);
							return;
						}
						if (response?.status !== 200) {
							vscode.window.showErrorMessage(`Failed to count records in ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'. Status: ${response?.status}`);
							return;
						}
						const recordCount = response.data.result.content[0].Aggregate_1;
						if (recordCount === 0) {
							vscode.window.showInformationMessage(`Table ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}' is already empty.`);
							return;
						}
						vscode.window.showWarningMessage(`Delete all ${recordCount} records from ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}' and reset its counters?`, { modal: true, }, { title: 'No' }, { title: 'Yes' }, ).then( async (selection) => {
							if (selection?.title !== 'Yes') {
								return;
							}
							response = await makeRESTRequest(
								"POST",
								this._serverSpec!,
								{ apiVersion: 1, namespace: this.namespace, path: "/action/query" },
								{
									query: `TRUNCATE TABLE ${schema}.${table}`,
								},
							);
							if (!response) {
								vscode.window.showErrorMessage(`Failed to truncate table ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'.`);
								return;
							}
							if (response?.status !== 200) {
								vscode.window.showErrorMessage(`Failed to truncate table ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'. Status: ${response?.status}`);
								return;
							}
							vscode.window.showInformationMessage(`Truncated table ${schema}.${table} on server '${this.serverId}' for namespace '${this.namespace}'.`);
						});
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
	<style type="text/css">
	  .hidden {
	    display: none;
	  }
	</style>
  </head>
  <body>

	<p>
    <vscode-collapsible id="collFiles" title="Data Files on Server" description="${this.serverFolderPath()}">
	  	<vscode-icon id="cmdRefresh" name="refresh" title="Refresh File List" slot="decorations"></vscode-icon>
        <vscode-table id="tblFiles" zebra bordered-columns resizable columns='["auto", "10%"]'>
          <vscode-table-header slot="header">
            <vscode-table-header-cell>Name</vscode-table-header-cell>
            <vscode-table-header-cell>Actions</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body id="tblbodyFiles" slot="body">
		  </vscode-table-body>
        </vscode-table>
        <vscode-divider></vscode-divider>
		<vscode-button id="cmdUploadFile" title="Choose a local file and upload it to the server">Upload New File to Server</vscode-button>
    </vscode-collapsible>
    </p>
	<p>
	    <vscode-collapsible title="Preview" id="collPreview" description="Select data file above">`  // keep description in sync with loaderScript.js
+ `
		  <vscode-textarea id="taFilePreview" monospace rows="5" cols="80" readonly value="No data file selected"></vscode-textarea>
		</vscode-collapsible>
	</p>
    <p>
	<vscode-label for="selSchema">Schema:</vscode-label>
	<vscode-single-select id="selSchema" combobox>`
+	schemata.map((schema: any) => `
		<vscode-option description="Table count: ${schema.NumberOfTables}">${schema.SchemaName}</vscode-option>`
	).join("")
+ `
	</vscode-single-select>
	</p>
    <p>
	<vscode-label for="selTable">Table:</vscode-label>
	<vscode-single-select id="selTable" combobox>
	</vscode-single-select>
	</p>

    <p>
    <vscode-collapsible title="Columns" id="collColumns" description="Select schema and table above">`  // keep description in sync with loaderScript.js
+ `
        <vscode-table id="tblColumns" zebra bordered-columns resizable columns='["4%", "auto", "10%", "9%", "9%", "9%", "9%", "9%", "9%", "9%"]'>
          <vscode-table-header slot="header">
		    <vscode-table-header-cell id="thLoad" title="No file preview available">Load?</vscode-table-header-cell>
            <vscode-table-header-cell title="Name of column">Name</vscode-table-header-cell>
            <vscode-table-header-cell title="Type of data stored in column">DataType</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if not nullable">Not Nullable</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if generated">Generated</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if not updatable">Not Updatable</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if identity column">Identity</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if autoincrement column">AutoIncrement</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if unique">Unique</vscode-table-header-cell>
            <vscode-table-header-cell title="Marked if primary key">PrimaryKey</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body id="tblbodyColumns" slot="body">`
+ `
          </vscode-table-body>
        </vscode-table>
        <vscode-divider></vscode-divider>
    </vscode-collapsible>
	</p>
	<p>
	<vscode-collapsible title="Advanced Load Options">
		<vscode-checkbox-group variant="vertical">
			<vscode-checkbox class="chkLoadOption" value="%NOCHECK">%NOCHECK — Disables unique value checking, foreign key referential integrity checking, NOT NULL constraints (required field checks), and validation for column data types, maximum column lengths, and column data constraints.</vscode-checkbox>
			<vscode-checkbox class="chkLoadOption" value="%NOINDEX">%NOINDEX — Disables the defining or building of index maps during INSERT processing. During the LOAD BULK DATA operation, SQL statements run against the target table might be incomplete or return incorrect results.</vscode-checkbox>
			<vscode-checkbox class="chkLoadOption" value="%NOLOCK">%NOLOCK — Disables locking of the row upon INSERT.</vscode-checkbox>
			<vscode-checkbox class="chkLoadOption" value="%NOJOURN">%NOJOURN — Suppresses journaling and disables transactions for the duration of the insert operations. Acquires a table-level lock on the target table, but each row is inserted with %NOLOCK. The table level lock is released when the load completes.</vscode-checkbox>
			<vscode-checkbox id="chkIntoJdbcThreads" value=1>Single-threaded load — Guarantees that data is loaded into the table in the exact order it appears in the file.</vscode-checkbox>
		</vscode-checkbox-group>
		<vscode-divider></vscode-divider>
		<a href="https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=RSQL_loaddata#RSQL_loaddata_desc_bulk">Documentation <vscode-icon name="link-external"></vscode-icon></a>
	</vscode-collapsible>
	</p>
	<p>
		<vscode-button id="cmdLoadData" disabled>Load Data from File into Table</vscode-button>
		<vscode-button id="cmdTruncateTable" secondary icon="warning" style="--vscode-button-secondaryHoverBackground: red;">TRUNCATE TABLE</vscode-button>
		<vscode-divider></vscode-divider>
		<a href="${this._serverSpec.webServer.scheme}://${this._serverSpec.webServer.host}:${String(this._serverSpec.webServer.port)}${this._serverSpec.webServer.pathPrefix}/csp/sys/op/%25CSP.UI.Portal.SQL.Logs.zen?$NAMESPACE=${this.namespace}">Review SQL Diagnostic Logs in IRIS Portal <vscode-icon name="link-external"></vscode-icon></a>
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

	public serverFolderUri(): vscode.Uri {
		return vscode.Uri.from({ scheme: "isfs", authority: `${this.serverId}:%sys`, path: `/_vscode/${this.namespace}/DataLoader`, query: "csp" });
	}

	public serverFolderPath(): string {
		return this._serverFolderPath;
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
