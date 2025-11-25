const vscode = acquireVsCodeApi();

var tmrPlaceholder = null;

// Handle the message inside the webview
window.addEventListener('message', event => {

  const message = event.data; // The JSON data our extension sent
  const selectTable = document.querySelector('#selectTable');
	const colTable = document.querySelector('#tblColumns');
	switch (message.command) {
    case 'load':
      //console.log(message.serverSpec);
      //console.log(message.namespace);
      //console.log(message.schemata);
      //console.log(message.dataFiles);
      break;
    case 'tables':
			selectTable.innerHTML = '';
			colTable.innerHTML = '';
			message.tables.forEach((table) => {
				const option = document.createElement('vscode-option');
				option.value = table.TableName;
				option.textContent = table.TableName;
				const description = table.Description.replace(/<br\s*\/?>/gi, '\n') || '';
				option.description = description.length > 200 ? description.substring(0, 197) + '...' : description;
				selectTable.appendChild(option);
			});
      break;
		case 'columns':
			colTable.innerHTML = '';
			const colHeader = document.createElement('vscode-table-header');
			colHeader.slot = 'header';
			colHeader.innerHTML = `
				<vscode-table-header-cell>Name</vscode-table-header-cell>
				<vscode-table-header-cell>DataType</vscode-table-header-cell>
				<vscode-table-header-cell>Description</vscode-table-header-cell>
			`;
			colTable.appendChild(colHeader);
			const colBody = document.createElement('vscode-table-body');
			colBody.slot = 'body';
			message.columns.forEach((column) => {
				const row = document.createElement('vscode-table-row');
				row.innerHTML = `
					<vscode-table-cell>${column.ColumnName}</vscode-table-cell>
					<vscode-table-cell>${column.DataType}</vscode-table-cell>
					<vscode-table-cell>${column.Description || ''}</vscode-table-cell>
				`;
				colBody.appendChild(row);
			});
			colTable.appendChild(colBody);
			break;
		case 'filePreview':
			const collPreview = document.querySelector('#collPreview');
			const taFilePreview = document.querySelector('#taFilePreview');
			if (!message.fileName) {
				collPreview.open=false;
				collPreview.description = "";
				taFilePreview.value = '';
				return;
			}
			collPreview.description = `First 10 lines of '${message.fileName}'`;
			taFilePreview.value = message.previewLines || '';
			collPreview.open=true;
			break;
  }
});

window.onload = function() {

	document.querySelector('#taFilePreview').wrappedElement.setAttribute('style', 'resize: both; white-space: nowrap;');

	document.querySelector('#selectSchema').addEventListener('change', (event) => {
		const select = event.target;
		const schema = select.value;
		vscode.postMessage({ command: 'schemaChanged', schema });
	});

	document.querySelector('#selectTable').addEventListener('change', (event) => {
		const select = event.target;
		const schema = document.querySelector('#selectSchema').value;
		const table = select.value;
		vscode.postMessage({ command: 'tableChanged', schema, table });
	});

	document.querySelector('#cmdUploadFile').addEventListener('click', (event) => {
		vscode.postMessage({ command: 'uploadFile' });
	});

  document.querySelectorAll('.btnPreviewFile').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
			vscode.postMessage({ command: 'previewFile', fileName: btn.dataset.filename });
		});
	});

  document.querySelectorAll('.btnDeleteFile').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
			vscode.postMessage({ command: 'deleteFile', fileName: btn.dataset.filename });
		});
	});

  document.querySelectorAll('.radioFileName').forEach((radio) => {
		radio.addEventListener('click', (_event) => {
			const fileName = radio.dataset.filename;
			const collPreview = document.querySelector('#collPreview');
			collPreview.open = false;
			collPreview.value = '';
			collPreview.dataset.filename = fileName;
			collPreview.description = fileName ? `First 10 lines of '${fileName}'` : '';
			vscode.postMessage({ command: 'selectFile', fileName });
		});
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
