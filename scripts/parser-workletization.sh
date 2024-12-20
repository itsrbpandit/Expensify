#!/bin/bash
###
# This script modifies the autocompleteParser.js file to be compatible with worklets.
# autocompleteParser.js is generated by PeggyJS and uses syntax not supported by worklets.
# This script runs each time the parser is generated by the `generate-autocomplete-parser` command.
###

filePath=$1

if [ ! -f "$filePath" ]; then
    echo "$filePath does not exist."
    exit 1
fi
# shellcheck disable=SC2016
if awk 'BEGIN { print "\47worklet\47\n\nclass peg\$SyntaxError{}" } 1' "$filePath" | sed 's/function peg\$SyntaxError/function temporary/g' | sed 's/peg$subclass(peg$SyntaxError, Error);//g' > tmp.txt; then
    mv tmp.txt "$filePath"
    echo "Successfully updated $filePath"
else
    echo "An error occurred while modifying the file."
    rm -f tmp.txt
    exit 1
fi
