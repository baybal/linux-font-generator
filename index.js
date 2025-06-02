#!/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'fs'

const fileList = readdirSync('../output')
/** @type {Map<string, string>} */
const files = new Map()

for(const i of fileList) files.set(i, readFileSync(`../output/${i}`,{encoding:'utf8'}))

/**
 * @param {string} str
 */
function processIt(str) {
    const noEmptyLine = str.replace(/^\n/m, '')
    const noDanglingSpaces= noEmptyLine.replace(/\s+$/gm, '')
    const tabs = noDanglingSpaces.replace(/\ \ +/gm, '\t')
    const re = /\t[^*\\]+\/\*\ [^*\\]+\ \*\/\n/g
    const hexRegex = /0[xX][0-9a-fA-F]+/g
    // const tokenz = tabs.match(re)
    const fontLines = {
        /** @type {number} */ noChars: 0,
        /** @type {number} */ charWidth: 0,
        /** @type {number} */ charHeight: 0,
        /** @type {string[]} */ characters: [],
        charsStr: ''
    }
    // const cutHeaderRegex = /(.+\n){8}(.*\/\* 255 \*\/\n)/
    // console.log(tokenz)
    let regexOut
    let i = 0
    while (regexOut = re.exec(tabs)) {
        const [match] = regexOut
        if (i > 7) fontLines.characters.push(match)
            else if (i === 4) {
                const arr = match.match(hexRegex)?.map(c => parseInt(c))
                if (!arr) break
                fontLines.noChars = new Uint32Array(new Uint8Array(arr).buffer)[0]
            }
            else if (i === 6) {
                const arr = match.match(hexRegex)?.map(c => parseInt(c))
                if (!arr) break
                fontLines.charWidth = new Uint32Array(new Uint8Array(arr).buffer)[0]
            }
            else if (i === 7) {
                const arr = match.match(hexRegex)?.map(c => parseInt(c))
                if (!arr) break
                fontLines.charHeight = new Uint32Array(new Uint8Array(arr).buffer)[0]
            }
        i++
    }
    fontLines.charsStr = fontLines.characters.map(l=>l.replace(/^\t/mg, '\t\t')).join('')
    return fontLines
}

for (const [k, v] of files) {
	const filenameSansExtension = k.replace(/\..*$/m, '')
	const fontType = filenameSansExtension[filenameSansExtension.length - 1]
	const process = processIt(v)
	const fontDataMax = process.charHeight * process.charWidth * process.characters.length
    const template = `// SPDX-License-Identifier: GPL-2.0
#include <linux/font.h>
#include <linux/module.h>

#define FONTDATAMAX ${fontDataMax}

static const struct font_data fontdata_ter${process.charWidth}x${process.charHeight}${fontType} = {
	{ 0, 0, ${fontDataMax}, 0 },
	{
${process.charsStr}	}
};

const struct font_desc font_ter_${process.charWidth}x${process.charHeight}${fontType} = {
	.idx = TER${process.charWidth}x${process.charHeight}${fontType.toUpperCase()}_IDX,
	.width = ${process.charWidth},
	.height = ${process.charHeight},
	.charcount = ${process.characters.length},
	.data = fontdata_ter${process.charWidth}x${process.charHeight}${fontType}.data,
#ifdef __sparc__
	.pref = 5,
#else
	.pref = -1,
#endif
};
`

	writeFileSync(`../processed/${k}`,template)
}
