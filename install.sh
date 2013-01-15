#!/bin/bash

STAGING="staging/"

echo "**** Cleaning Chronos"

rm com.openmobl.app.chronos_*

if [ ! -d ${STAGING} ]; then
    mkdir ${STAGING}
else
    rm -rf ${STAGING}
    mkdir ${STAGING}
fi;

echo "**** Staging Chronos"

cp -R com.openmobl.app.chronos/ ${STAGING}

echo "**** Packaging Chronos"

palm-package ${STAGING}

echo "**** Installing Chronos"

palm-install com.openmobl.app.chronos_*