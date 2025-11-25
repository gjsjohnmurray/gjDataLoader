const vscode = acquireVsCodeApi();

var tmrPlaceholder = null;

// Handle the message inside the webview
window.addEventListener('message', event => {

  const message = event.data; // The JSON data our extension sent
  switch (message.command) {
    case 'load':
      //console.log(message.serverSpec);
      //console.log(message.namespace);
      //console.log(message.registryRows);
      //console.log(message.moduleRows);
      break;
    case 'tables':
			const selectTable = document.querySelector('#selectTable');
			selectTable.innerHTML = '';
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
			const colTable = document.querySelector('#tblColumns');
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
  }
});

window.onload = function() {

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

  const tfCommand = document.querySelector('#tfCommand');
  const taOutput = document.querySelector('#taOutput');

  document.querySelector('#radioRepoNoModule').checked = true;
  document.querySelectorAll('.radioRepoModule').forEach((radio) => {
    if (radio.id === 'radioRepoNoModule') {
      radio.addEventListener('click', (_event) => {
        document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
          btn.disabled = true;
        });
      });
    } else {
      radio.addEventListener('click', (_event) => {
        document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
          btn.disabled = false;
        });
      });
    }
  });

  document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      var repo = btn.dataset.reponame;
      var module;
      document.querySelectorAll('.radioRepoModule').forEach((el) => {
        if (el.checked) {
          module = el.dataset.module;
        }
      });
      if (repo && module) {
        const text = `${btn.dataset.command} ${repo}/${module}`;
        vscode.postMessage({ command: 'input', text });
        tfCommand.value = text;
        tfCommand.wrappedElement.setSelectionRange(0, text.length);
        tfCommand.wrappedElement.focus();
      }
    });
  });

  document.querySelectorAll('.radioModule').forEach((radio) => {
    radio.addEventListener('click', (_event) => {
      document.querySelectorAll('.cmdButton').forEach((btn) => {
        btn.disabled = false;
      });
    });
  });

  document.querySelectorAll('.btnOpenModuleRepo').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      vscode.postMessage({ command: 'openExternal', url: btn.dataset.url });
    });
  });

  document.querySelectorAll('.cmdButton').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      var module;
      document.querySelectorAll('.radioModule').forEach((el) => {
        if (el.checked) {
          module = el.dataset.module;
        }
      });
      if (module) {
        const text = `${btn.dataset.command} ${module}`;
        vscode.postMessage({ command: 'input', text });
        tfCommand.value = text;
        tfCommand.wrappedElement.setSelectionRange(0, text.length);
        tfCommand.wrappedElement.focus();
      }
    });
  });

  tfCommand.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      vscode.postMessage({ command: 'input', text: tfCommand.value });
    }
  });
  tfCommand.style.width = taOutput.offsetWidth + 'px';

  taOutput.wrappedElement.style.whiteSpaceCollapse = 'preserve';
  taOutput.wrappedElement.style.textWrap = 'nowrap';

  const btnHelp = document.querySelector('#btnHelp');
  btnHelp.addEventListener('click', (_event) => {
    vscode.postMessage({ command: 'openExternal', url: 'https://github.com/intersystems/ipm/wiki/02.-CLI-commands' });
  });
  const btnClear = document.querySelector('#btnClear');
  btnClear.addEventListener('click', (_event) => {
    tfCommand.value = '';
    taOutput.value = '';
  });

  vscode.postMessage({ command: 'ready' });
  };
