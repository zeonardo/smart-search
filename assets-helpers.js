
const through      = require('through2');
const {copySync, removeSync, readdirSync, stat, writeFileSync, outputFile, statSync} = require('fs-extra');
const glob = require('glob');
const path = require('path');

const flat = (arr) => [].concat.apply([], arr);

const Benchmark = (msg) => through.obj((file, enc, cb) => {
  global.benchmark.mark(msg);
  cb(null, file);
});

function ClearFolder(folderPath, removeFn = removeSync){
  if(Array.isArray(folderPath)) {
    return folderPath.map(currentFolder => removeFn(currentFolder));
  } else {
    return removeFn(folderPath);
  }
}

function filenameFormat(filename) {
  return `${filename}`.toLowerCase().replace(/(\s)+/gi, '-');
}

function RemoveDuplicates(files, brands) {

  return files.map((str) => str.match(new RegExp(`(?:shared|brands\/(${brands.join('|')}))\/.*`, 'gi'))[0])
              .reduce((dedupFiles, value) => {

                let valueReplaced = value.replace(new RegExp(`(?:shared|brands\/(${brands.join('|')}))\/`, 'gi'), '');

                let hasItem = dedupFiles.reduce((_acc, v) => {
                  if(v.match(new RegExp(valueReplaced, 'gi'))){
                    _acc.push(v);
                  }
                  return _acc;
                }, []);

                if(hasItem.length === 0) {
                  dedupFiles.push(value);
                }

                return dedupFiles;
              }, []);
}

const MergeFiles = ({brands}) => (brand, assetPath, filesGlob, sharedFiles = null, brandFiles = null) => {
  sharedFiles = sharedFiles || glob.sync(`./shared/${assetPath}/**/${filesGlob}`);
  brandFiles  = brandFiles || glob.sync(`./brands/${brand}/${assetPath}/**/${filesGlob}`);

  let files   = brandFiles.concat(sharedFiles);

  let result = RemoveDuplicates(files, brands);

  return result;
};

const Copy = ({brands}) => (brand, tmpPath, files, _path, copy = copySync) => {
  const replacePattern   = new RegExp(`(?:shared\/brands\/(?:${brands.join('|')})\/)(.*)`, 'gi');
  files.forEach((file) => {
    copy(file, path.join(tmpPath, brand, file.replace(replacePattern, '$1')));
  });
};

const MergeAndCopy = (buildData) => (brand, tmpPath, folder, filesGlob, cb) => {
  let files = MergeFiles(buildData)(brand, folder, filesGlob);
  Copy(buildData)(brand, tmpPath, files, folder);
  return typeof(cb) === 'function' && cb();
};

function Capitalize(str) {
  return str.slice(0,1).toUpperCase() + str.slice(1, str.length).toLowerCase();
}

function writePromise(destPath, _file, overwrite = false){

  return new Promise((resolve, reject) => {
    stat(path.join(destPath, _file.basename), (err, stats) => {
      if (!overwrite && stats && stats.isFile()) {
        reject('File already exists');
      } else {
        outputFile(path.join(destPath, _file.basename), _file.contents, (err) => err ? reject(err) : resolve(true));
      }

    });
  });
}

module.exports = {
  ClearFolder,
  filenameFormat,
  RemoveDuplicates,
  MergeFiles,
  Copy,
  MergeAndCopy,
  Capitalize,
  writePromise,
  Benchmark,
  flat
};
