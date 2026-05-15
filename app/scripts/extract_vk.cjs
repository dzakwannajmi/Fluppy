const fs = require('fs');

const vk = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);

function decTo32Bytes(dec) {
  let hex = BigInt(dec).toString(16);

  while (hex.length < 64) {
    hex = '0' + hex;
  }

  return Buffer.from(hex, 'hex');
}

function g1(point) {
  return Buffer.concat([
    decTo32Bytes(point[0]),
    decTo32Bytes(point[1]),
  ]);
}

function fq2(pair) {
  return Buffer.concat([
    decTo32Bytes(pair[0]),
    decTo32Bytes(pair[1]),
  ]);
}

function g2(point) {
  return Buffer.concat([
    fq2(point[0]),
    fq2(point[1]),
  ]);
}

function toRustArray(buf) {
  return `[${Array.from(buf).join(', ')}]`;
}

console.log('\n// delta_g2');
console.log(toRustArray(g2(vk.vk_delta_2)));

console.log('\n// IC points');
vk.IC.forEach((p, i) => {
  console.log(`\n// IC[${i}]`);
  console.log(toRustArray(g1(p)));
});

console.log(`\n// IC length = ${vk.IC.length}`);