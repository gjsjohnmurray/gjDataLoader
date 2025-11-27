const vscode = acquireVsCodeApi();

var tmrPlaceholder = null;

// Handle the message inside the webview
window.addEventListener('message', event => {

  const message = event.data; // The JSON data our extension sent
  const selTable = document.querySelector('#selTable');
	const tblbodyColumns = document.querySelector('#tblbodyColumns');
	const tblbodyFiles = document.querySelector('#tblbodyFiles');
	const collFiles = document.querySelector('#collFiles');
	const collColumns = document.querySelector('#collColumns');
	switch (message.command) {
    case 'load':
      //console.log(message.serverSpec);
      //console.log(message.namespace);
      //console.log(message.schemata);
      break;
    case 'tables':
			selTable.innerHTML = '';
			document.querySelector('#cmdLoadData').disabled = true;
			collColumns.open = false;
			collColumns.description = "Select schema and table above"; // keep in sync with loader.ts
			tblbodyColumns.innerHTML = '';
			message.tables.forEach((table) => {
				const option = document.createElement('vscode-option');
				option.value = table.TableName;
				option.textContent = table.TableName;
				const description = table.Description.replace(/<br\s*\/?>/gi, '\n') || '';
				option.description = description.length > 200 ? description.substring(0, 197) + '...' : description;
				selTable.appendChild(option);
			});
      break;
		case 'columns':
			tblbodyColumns.innerHTML = '';
			collColumns.description = `Structure of table '${message.schema}.${message.table}'`;
			message.columns.forEach((column) => {
				const row = document.createElement('vscode-table-row');
				let title = column.Description.replace(/<br\s*\/?>/gi, '\n').replace(/\"/gi, '&quot;');
				if (title.replace(/\r/g, '').replace(/\n/g, '').trim().length === 0) {
					title = column.ColumnName;
				}
				row.innerHTML = `
					<vscode-table-cell title="${title}">${column.ColumnName}</vscode-table-cell>
					<vscode-table-cell>${column.DataType}</vscode-table-cell>
					<vscode-table-cell>${column.IsNullable === 'NO' ? '<vscode-icon name="close"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsGenerated === 'YES' ? '<vscode-icon name="check"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsUpdatable === 'NO' ? '<vscode-icon name="close"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsIdentity === 'YES' ? '<vscode-icon name="check"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsAutoIncrement === 'YES' ? '<vscode-icon name="check"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsUnique === 'YES' ? '<vscode-icon name="check"></vscode-icon>' : ''}</vscode-table-cell>
					<vscode-table-cell>${column.IsPrimaryKey === 'YES' ? '<vscode-icon name="check"></vscode-icon>' : ''}</vscode-table-cell>
				`;
				tblbodyColumns.appendChild(row);
			});
			collColumns.open = true;
			// Below gives a script error with v2.3.1 - see https://github.com/vscode-elements/elements/issues/561
			// tblColumns.columns = tblColumns.columns; // force refresh
			break;
		case 'dataFiles':
			tblbodyFiles.innerHTML = '';
			document.querySelector('#cmdLoadData').disabled = true;
			document.querySelector('#collPreview').description = 'Select data file above'; // keep in sync with loader.ts
			message.dataFiles.forEach((dataFile) => {
				const row = document.createElement('vscode-table-row');
				row.title=dataFile[0];
				row.innerHTML = `
          <vscode-table-cell>
						<vscode-radio class="radioFileName" name="radioFileName" title="Select '${dataFile[0]}'" data-filename="${dataFile[0]}">
							${dataFile[0]}
						</vscode-radio>
				  </vscode-table-cell>
          <vscode-table-cell>
						<span title="Delete '${dataFile[0]}'">
							<vscode-icon class="btnDeleteFile" name="trash" action-icon label="Delete '${dataFile[0]}'" data-filename="${dataFile[0]}"></vscode-icon>
						</span>
					</vscode-table-cell>
					`;
				tblbodyFiles.appendChild(row);
			});

			document.querySelectorAll('.radioFileName').forEach((radio) => {
				radio.addEventListener('click', (_event) => {
					const fileName = radio.dataset.filename;
					const collPreview = document.querySelector('#collPreview');
					collPreview.open = false;
					collPreview.value = '';
					collPreview.dataset.filename = fileName;
					document.querySelector('#cmdLoadData').disabled = !document.querySelector('#selTable')?.value;
					collPreview.description = fileName ? `Expand to fetch '${fileName}' and display first 10 lines` : 'Select data file above'; // keep in sync with loader.ts
					vscode.postMessage({ command: 'selectFile', fileName });
				});
			});

			document.querySelectorAll('.btnDeleteFile').forEach((btn) => {
				btn.addEventListener('click', (_event) => {
					vscode.postMessage({ command: 'deleteFile', fileName: btn.dataset.filename });
				});
			});
			collFiles.open = true;
			// Below gives a script error with v2.3.1 - see https://github.com/vscode-elements/elements/issues/561
			//tblFiles.columns = tblFiles.columns; // force refresh
			break;
		case 'filePreview':
			const collPreview = document.querySelector('#collPreview');
			const taFilePreview = document.querySelector('#taFilePreview');
			if (!message.fileName) {
				collPreview.open = false;
				collPreview.description = "Select data file above"; // keep in sync with loader.ts
				taFilePreview.value = '';
				return;
			}
			collPreview.description = `First 10 lines of '${message.fileName}'`;
			taFilePreview.value = message.previewLines || '';
			collPreview.open = true;
			break;
  }
});

window.onload = function() {

	document.querySelector('#taFilePreview').wrappedElement.setAttribute('style', 'resize: both; white-space: nowrap;');

	document.querySelector('#selSchema').addEventListener('change', (event) => {
		const select = event.target;
		const schema = select.value;
		vscode.postMessage({ command: 'schemaChanged', schema });
	});

	document.querySelector('#selTable').addEventListener('change', (event) => {
		const select = event.target;
		const schema = document.querySelector('#selSchema').value;
		const table = select.value;
		document.querySelector('#cmdLoadData').disabled = !document.querySelector('#collPreview')?.dataset.filename
		vscode.postMessage({ command: 'tableChanged', schema, table });
	});

	document.querySelector('#cmdUploadFile').addEventListener('click', (event) => {
		vscode.postMessage({ command: 'uploadFile' });
	});

	document.querySelector('#cmdLoadData').addEventListener('click', (event) => {
		const fileName = document.querySelector('#collPreview')?.dataset.filename;
		if (!fileName) {
			vscode.postMessage({ command: 'showErrorMessage', text: 'You must select a data file to load.' });
			return;
		}
		const schema = document.querySelector('#selSchema').value;
		const table = document.querySelector('#selTable').value;
		if (!schema || !table) {
			vscode.postMessage({ command: 'showErrorMessage', text: 'You must select a schema and table to load into.' });
			return;
		}
		vscode.postMessage({ command: 'loadData', schema, table, fileName });
	});

	document.querySelector('#cmdRefresh').addEventListener('click', (event) => {
		event.stopPropagation(); // prevent collapsible toggle
		vscode.postMessage({ command: 'refreshFileList' });
	});

	document.querySelector('#collPreview').addEventListener('vsc-collapsible-toggle', (event) => {
		const collPreview = event.target;
		const fileName = collPreview.dataset.filename;
		if (fileName && collPreview.open) {
			document.querySelector('#taFilePreview').value = 'Loading preview...';
			vscode.postMessage({ command: 'previewFile', fileName });
		}
	});

  vscode.postMessage({ command: 'ready' });
  };
