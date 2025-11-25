#ARG IMAGE=intersystemsdc/irishealth-community
ARG IMAGE=intersystemsdc/iris-community
FROM $IMAGE

WORKDIR /home/irisowner/dev

COPY App.Installer.cls ./

RUN --mount=type=bind,src=.,dst=. \
    ISC_CPF_MERGE_FILE=/home/irisowner/dev/config_merge.cpf iris start IRIS && \
	iris session IRIS < iris.script && \
    iris stop IRIS quietly