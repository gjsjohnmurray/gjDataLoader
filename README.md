# gj :: dataLoader

This VS Code extension provides a convenient way to load data into InterSystems IRIS SQL tables from CSV-formatted data files.


> A target IRIS server must previously have been configured to [maintain folder-specific settings](https://docs.intersystems.com/components/csp/docbook/DocBook.UI.Page.cls?KEY=GVSCO_serverflow#GVSCO_serverflow_folderspec), otherwise you will receive the following error notification in VS Code:
> ```
> No /_vscode web application available on server 'XXX'.
> ```
> If your server already has InterSystems Package Manager (IPM / ZPM) installed you can use the following IRIS Terminal command to set this up:
> 
> `zpm "install vscode-per-namespace-settings"`
> 
>Alternatively, install that package using our [InterSystems Package Manager](https://marketplace.visualstudio.com/items?itemName=georgejames.iris-package-manager) extension.

## Getting Started

1. Install the [**gj :: dataLoader**](https://marketplace.visualstudio.com/items?itemName=georgejames.data-loader) extension.
2. In the **Servers** view of the **InterSystems** view container contributed by the InterSystems Server Manager extension, expand the **Namespaces** subfolder of your target server.
3. Click the **'Load Data'** button that **gj :: dataLoader** contributes to every namespace except for %SYS, which is intentionally omitted because of the dangers of modifying data there.
4. In the Data Loader tab that appears in the editor area:
   * Use the **'Upload New File to Server'** button in the **DATA FILES ON SERVER** section to send your CSV-formatted file to the server. The first line of the file must contain column names that match those of the target table.
   * When the filename appears in the list above the button, select it.
   * Expand the **PREVIEW** section to check the file's contents, particularly the header line.
   * Choose the target **Schema** and **Table**.
   * Review the **COLUMNS** list, and optionally deselect any you don't want to populate from the file.
5. When you are ready, click **'Load Data from File into Table'**. This runs a `LOAD DATA` SQL statement on the server. You can read more about this command [here](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=RSQL_loaddata).

## Release Notes

See the [CHANGELOG](CHANGELOG.md) for changes in each release.

## Known Issues
1. Table column widths do not resize correctly after the contents are loaded. This appears to be a bug in the [VSCode Elements](https://vscode-elements.github.io/) library. Workaround is to click on the column splitter between the misaligned columns.

## Feedback

Please use https://github.com/gjsjohnmurray/gjDataLoader/issues to report bugs and suggest improvements.

## About George James Software

Known for our expertise in InterSystems technologies, George James Software has been providing innovative software solutions for over 35 years. We focus on activities that can help our customers with the support and maintenance of their systems and applications. Our activities include consulting, training, support, and developer tools - with Deltanji source control being our flagship tool. Our tools augment InterSystems' technology and can help customers with the maintainability and supportability of their applications over the long term. 

To find out more, go to our website - [georgejames.com](https://georgejames.com) 
