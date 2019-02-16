#!/bin/bash

if [[ $@ == 'debug' ]]
then
        export DEBUG="neeo:ziggo-horizon*"
fi

npx neeo-cli start
