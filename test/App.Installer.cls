/// an example of Installer class just to create a new clear namespace and databases IRISAPP-DATA and IRISAPP-CODE
Class App.Installer
{

XData setup
{
<Manifest>
  <Namespace Name="DATALOAD-DEMO" Code="DATALOAD-DEMO-CODE" Data="DATALOAD-DEMO-DATA" Create="yes" Ensemble="0">
    <Configuration>
      <Database Name="DATALOAD-DEMO-DATA" Dir="${mgrdir}dataload-demo/data" Create="yes" Resource="%DB_DATALOAD-DEMO-DATA"/>
      <Database Name="DATALOAD-DEMO-CODE" Dir="${mgrdir}dataload-demo/code" Create="yes" Resource="%DB_DATALOAD-DEMO-CODE"/>
    </Configuration>
  </Namespace>

</Manifest>
}

ClassMethod setup(ByRef pVars, pLogLevel As %Integer = 3, pInstaller As %Installer.Installer, pLogger As %Installer.AbstractLogger) As %Status [ CodeMode = objectgenerator, Internal ]
{
  #; Let XGL document generate code for this method.
  Quit ##class(%Installer.Manifest).%Generate(%compiledclass, %code, "setup")
}

}
