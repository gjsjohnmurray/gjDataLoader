# gj :: dataLoader

This VS Code extension provides a convenient way to load data into [InterSystems IRIS](https://intersystems.com) SQL tables from CSV-formatted data files.

It implements an idea posted at https://ideas.intersystems.com/ideas/DPI-I-667 and was entered into the InterSystems ["Bringing Ideas to Reality" Contest 2025](https://openexchange.intersystems.com/contest/44).


> Any target IRIS server must already be set up to maintain folder-specific settings for VS Code, otherwise you will receive the following error notification in VS Code:
> ```
> No /_vscode web application available on server 'xxx'.
> ```
> If your server has InterSystems Package Manager (IPM / ZPM) installed you can use the following IRIS Terminal command to perform the setup:
> 
> `zpm "install vscode-per-namespace-settings"`
> 
> Alternatively use our [InterSystems Package Manager](https://marketplace.visualstudio.com/items?itemName=georgejames.iris-package-manager) extension to install the [`vscode-per-namespace-settings`](https://openexchange.intersystems.com/package/vscode-per-namespace-settings) package from within VS Code.
>
> If you cannot use IPM to set up the `/_vscode web` application, follow the [manual steps](https://docs.intersystems.com/components/csp/docbook/DocBook.UI.Page.cls?KEY=GVSCO_serverflow#GVSCO_serverflow_folderspec).

> This extension uses the [LOAD DATA](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=RSQL_loaddata) command which itself uses an underlying Java-based engine that requires a Java Virtual Machine (JVM) installation on your server. If you already have a JVM set up and accessible in your PATH environment variable, then the first time you use LOAD DATA, InterSystems IRIS automatically uses that JVM to start an External Language Server. To customize your External Language Server to use a specific JVM, or to use a remote server, see [Managing External Server Connections](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=BEXTSERV_managing).

## Getting Started

1. Install the [**gj :: dataLoader**](https://marketplace.visualstudio.com/items?itemName=georgejames.data-loader) extension.
2. In the **Servers** view of the **InterSystems** view container contributed by the InterSystems Server Manager extension (a dependency of this extension), expand the **Namespaces** subfolder of your target server.
3. Click the **'Load Data'** button that **gj :: dataLoader** contributes to every namespace except for %SYS, which is intentionally omitted because of the dangers of modifying data there.
4. In the Data Loader tab that appears in the editor area:
   * Use the **'Upload New File to Server'** button in the **DATA FILES ON SERVER** section to send your CSV-formatted file to the server. The first line of the file must contain column names that match those of the target table.
   * When the filename appears in the list above the button, select it.
   * Expand the **PREVIEW** section to check the file's contents, particularly the header line.
   * Choose the target **Schema** and **Table**.
   * Review the **COLUMNS** list, and optionally deselect any you don't want to populate from the file.
5. When you are ready, click **'Load Data from File into Table'**. This runs a `LOAD DATA` SQL statement on the server. You can read more about this command [here](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=RSQL_loaddata).

If the target table already contains records then the contents of the data file will be added to these, subject to any uniqueness constraints defined by the table's class definition. In other words, INSERT is used rather than UPDATE.

A **"TRUNCATE TABLE"** button can be used to run that SQL command on the target table. Make sure you [understand the consequences](https://docs.intersystems.com/irislatest/csp/docbook/Doc.View.cls?KEY=RSQL_truncatetable) of this action before using it.

An **ADVANCED LOAD OPTIONS** section allows you to modify certain aspects of the data load process.

By design the LOAD DATA command will succeed even if some (potentially all) of the records in the data file are skipped. Full details are logged on the server's SQL Diagnostic Logs, and a link is provided with which to review these in IRIS Portal in an external web browser (requires IRIS 2023.1 or later).

## Release Notes

See the [CHANGELOG](CHANGELOG.md) for changes in each release.

## Known Issues
1. Table column widths do not resize correctly after the contents are loaded. This is a bug in the [VSCode Elements](https://vscode-elements.github.io/) library. Work around it by clicking on the column splitter between the misaligned columns.

## Feedback

Please use https://github.com/gjsjohnmurray/gjDataLoader/issues to report bugs and suggest improvements.

## About George James Software

Known for our expertise in InterSystems technologies, George James Software has been providing innovative software solutions for over 35 years. We focus on activities that can help our customers with the support and maintenance of their systems and applications. Our activities include consulting, training, support, and developer tools - with Deltanji source control being our flagship tool. Our tools augment InterSystems' technology and can help customers with the maintainability and supportability of their applications over the long term. 

To find out more, go to our website - [georgejames.com](https://georgejames.com) 
