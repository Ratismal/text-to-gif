const GIFEncoder = require('gifencoder');
const im = require('gm').subClass({
    imageMagick: true
});
const Jimp = require('jimp');
const ArgumentParser = require('argparse').ArgumentParser;
const parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Converts text to gif(s)'
});

const path = require('path');
const fs = require('fs');

parser.addArgument(['-i', '--input'], {
    help: 'The file containing the text to convert.',
    defaultValue: 'input'
});
parser.addArgument(['-o', '--output'], {
    help: 'Where to store the gif(s)',
    defaultValue: 'output'
});
parser.addArgument(['-c', '--columns'], {
    help: 'The number of column gifs to generate',
    defaultValue: 1,
    type: Number
});
parser.addArgument(['-r', '--rows'], {
    help: 'The number of row gifs to generate',
    defaultValue: 1,
    type: Number
});
parser.addArgument(['-d', '--delay'], {
    help: 'The delay between frames in ms',
    defaultValue: 250,
    type: Number
});
parser.addArgument(['-f', '--fill'], {
    help: 'The color of the text',
    defaultValue: 'white'
});
parser.addArgument(['-b', '--background'], {
    help: 'The color of the background',
    defaultValue: 'black'
});
parser.addArgument(['-s', '--size'], {
    help: 'The height and width (in pixels)',
    defaultValue: 35,
    type: Number
});
parser.addArgument(['-m', '--margin'], {
    help: 'The margin gap (in pixels)',
    defaultValue: 2,
    type: Number
});


const args = parser.parseArgs();

async function main() {
    let input = path.join(process.cwd(), args.input);

    let output_base = path.join(process.cwd(), args.output);

    let data = fs.readFileSync(input, { encoding: 'utf8' });
    let words = data.split(/\s+/);
    let height = args.size, width = args.size, margin = args.margin;

    let encoders = [];
    for (let y = 0; y < args.rows; y++) {
        let row = [];
        for (let x = 0; x < args.columns; x++) {
            let encoder = new GIFEncoder(width - margin, height - margin);
            encoder.createReadStream().pipe(fs.createWriteStream(output_base + `${x}-${y}.gif`));
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(args.delay);
            encoder.setQuality(10);
            row.push(encoder);
        }
        encoders.push(row);
    }
    let max = words.length;
    let i = 0;
    let loading = ['\\', '|', '/', '-'];
    for (const word of words) {
        process.stdout.write(`${loading[i % 4]} Generating | ${i + 1}/${max} (${Math.floor((i + 1) / max * 10000) / 100}%) | ${word}                    \r`);
        i++;
        let img = im().command('convert');
        img.out('-size').out(`${width * args.columns * 0.80}x${height * args.rows * 0.50}`);
        img.out('-background').out(args.background);
        img.out('-fill').out(args.fill);
        img.out('-gravity').out('Center');
        // img.out('-pointsize').out(`100`);
        // img.out('-annotate').out('0').out(word);
        img.out(`caption: ${word}`);
        img.out('-extent').out(`${width * args.columns}x${height * args.rows}`);
        img.setFormat('png');
        let buf = await imToBuffer(img);
        let jimg = await Jimp.read(buf);

        for (let y = 0; y < args.rows; y++) {
            for (let x = 0; x < args.columns; x++) {
                let encoder = encoders[y][x];

                let i = new Jimp(width - margin, height - margin, 0x0);
                i.composite(jimg, x * -width, y * -height);
                encoder.addFrame(i.bitmap.data);
            }
        }
    }
    for (let y = 0; y < args.rows; y++) {
        for (let x = 0; x < args.columns; x++) {
            encoders[y][x].finish();
        }
    }
}

function imToBuffer(data) {
    return new Promise((resolve, reject) => {
        data.stream((err, stdout, stderr) => {
            if (err) { return reject(err) }
            const chunks = []
            stdout.on('data', (chunk) => { chunks.push(chunk) })
            // these are 'once' because they can and do fire multiple times for multiple errors,
            // but this is a promise so you'll have to deal with them one at a time
            stdout.once('end', () => { resolve(Buffer.concat(chunks)) })
            stderr.once('data', (data) => { reject(String(data)) })
        })
    })
}


main().then(() => {
    console.log('Finished!');
}).catch(err => {
    console.error(err);
}) 