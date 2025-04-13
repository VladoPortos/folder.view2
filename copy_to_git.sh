#!/bin/bash

CWD=`pwd`

rm -Rf $CWD/src/folder.view2/usr/local/emhttp/plugins/folder.view2/*
cp /usr/local/emhttp/plugins/folder.view2/* $CWD/src/folder.view2/usr/local/emhttp/plugins/folder.view2 -R -v -p
chmod -R 0755 ./
chown -R root:root ./