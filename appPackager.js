var config = {
	packageExt:'.appjs'
	,modulePackageExt:'.modpack'
	,appInfoFile:'package.json'
	,deployFolder:'deploy'
	,archiver:'node-native-zip'//'archiver' or 'node-native-zip'
	,zipPackage:'archiver'//'archiver'
	,delRawPackage:true
}
var appInfo = {
	name:"Unnamed"
	,version:0.1
	,moduleUrl:'http://example.com/node_modules/'
	,appUpdateUrl:'http://example.com/apps/appname.txt'
	,silentUpdates:true
	,appdeps:{
	
	}
};
if (process.argv.length < 3) {
	console.log("usage: appPackager <folder to pack or package to unpack>");
	process.exit(1);
}
var fs = require("fs");
var path = require("path");

var appPackage = "";
var modulesWaiting = 0;
var modulesWritten = function() {
	//console.log("modules written");
	//appInfo.packageVer = appInfo.packageVer+1;
	
	fs.writeFile(appFolder+"/"+config.appInfoFile,JSON.stringify(appInfo, null,4),function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log("wrote "+appFolder+"/"+config.appInfoFile);
		}
		packageApp();
	});
	fs.writeFile(appFolder+"/deploy/"+appInfo.name+".appjs.json",JSON.stringify(appInfo, null,4),function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log("wrote "+appFolder+"/deploy/"+appInfo.name+".appjs.json");
		}
	});
}
var appFolder = './';
				
fs.stat(process.argv[2], function(err, stats) {
	if (err) {
		console.log(err);
		process.exit(1);
	}
	if (stats.isDirectory()) {
		appFolder = process.argv[2];
		fs.mkdir(appFolder+'/'+config.deployFolder, function(err) {
			//if (err) console.log(err);
			appPackage = appFolder + "/" + config.deployFolder +"/"+path.basename(appFolder)+ config.packageExt;
		
			fs.exists(appFolder+"/"+config.appInfoFile,function(exists) {
			
				if (!exists) {
					appInfo.name=path.basename(appFolder);
					scanModules();	
				} else {
					fs.readFile(appFolder+"/"+config.appInfoFile, 'utf8', function (err,data) {
					  if (err) {
						console.log(err);
					  } else {
						appInfo = JSON.parse(data);
						appPackage = appFolder + "/" + config.deployFolder +"/"+appInfo.name+ config.packageExt;
		
					  }
					scanModules();
					});
				}
			});
		});
	}
	if (stats.isFile()) {
		var apack = require('adm-zip');
		appPackage = process.argv[2];
		appFolder = appPackage.substring(0,appPackage.lastIndexOf('.'));
		process.stdout.write("unpacking "+appPackage+'\n');
		var archive = new apack(appPackage);
		archive.extractAllTo(appFolder, true);
		process.stdout.write("unpacked to "+appFolder+'\n');
	}
});

function packageApp(extraFiles,callBack) {
	process.stdout.write('scanning folder: '+appFolder+'\n');
	var exclude= {
		'bin':'bin'
		,'node_modules':'node_modules'
		,'deploy':'deploy'
	}
	walk(appFolder,function(err,files) {
		if (err) {
			process.stdout.write('Error:' + err);
		} else {
			if (config.archiver == "node-native-zip") {
				var apack = require("node-native-zip");
				if (extraFiles) {
					for(var i=0; i< extraFiles.length;i++) {
						files.push(extraFiles[i]);
					}				
				}
				var archive = new apack(appPackage);
				archive.addFiles(files, function (err) {
					if (err) {
						process.stdout.write("error while adding files: "+ err);
					} else {
						var buff = archive.toBuffer();
						fs.writeFile(appPackage, buff, function () {
							process.stdout.write("wrote "+appPackage+'\n');
							if (config.zipPackage == 'archiver') {
								var archiver = require("archiver");//alternative: zipstream-ctalkington
								var out = fs.createWriteStream(appPackage+'.zip');
								var zip = archiver.createZip({ level: 1 });
								zip.pipe(out);
								zip.addFile(fs.createReadStream(appPackage), { name: path.basename(appPackage),store:false }, function() {
									zip.finalize(function(written) { 
										console.log("wrote "+appPackage+".zip "+Math.round(written/1024)+'k\n');
										if (callBack) {
											callBack();
										}
									});	
								});
							} else {							
								if (callBack) {
									callBack();
								}
							}
						});
					}
				});
			}
			if (config.archiver == "archiver") {
				var archiver = require("archiver");//alternative: zipstream-ctalkington
				var out = fs.createWriteStream(appPackage);
				var zip = archiver.createZip({ level: 1 });
				zip.pipe(out);
				var filepos=files.length;
				var addAnotherFile = function() {
					filepos--;
					if (filepos>-1) {
						//console.log(files[filepos].name);
						zip.addFile(fs.createReadStream(files[filepos].path), { name: files[filepos].name,store:true }, function() {
							addAnotherFile();
						});
					} else {
						zip.finalize(function(written) { 
							console.log("wrote "+appPackage+" "+Math.round(written/1024)+'k\n');
						});
					}
				}
				addAnotherFile();
			}
		}
	},exclude);
}


function scanModules() {
	//scan node modules
	console.log("scanning node_modules");
	fs.readdir(appFolder+"/node_modules", function(err, list) {
		if (err) {
			if (err.code ==  'ENOENT') {
				//node_modules directory does not exist.
				console.log("node_modules directory not found.");
				modulesWritten();
			} else {
				console.log(err);
			}
		} else {
			list.forEach(function(file) {
				var module = appFolder +"/node_modules" + '/' + file;
				fs.stat(module, function(err, stat) {
					if (stat && stat.isDirectory()) {
						var exclude = {};
						//package this module.
						fs.stat(module+"/package.json", function(err,stat) {
							if (stat && stat.isFile()) {
								fs.readFile(module+"/package.json", 'utf8', function (err,data) {
								  if (err) {
									return console.log(err);
								  }
								  var modPackageInfo = JSON.parse(data);
								  if (!appInfo.appdeps[modPackageInfo.name]) {
									appInfo.appdeps[modPackageInfo.name] = {};
								  }
								  appInfo.appdeps[modPackageInfo.name].name = modPackageInfo.name;
								  appInfo.appdeps[modPackageInfo.name].version = modPackageInfo.version;
								  if (!appInfo.appdeps[modPackageInfo.name]['platforms']) appInfo.appdeps[modPackageInfo.name].platforms = {};
								  appInfo.appdeps[modPackageInfo.name].platforms[process.platform] = process.platform;
								  if (appInfo.appdeps[modPackageInfo.name]['crossPlatform'] == true) {
									packModule(module,modPackageInfo.name+"-"+modPackageInfo.version,appFolder);
								  } else {
									packModule(module,modPackageInfo.name+"-"+modPackageInfo.version+"-"+process.platform,appFolder);
								  }
								  
								});
							} else {
								packModule(module,file+"."+process.platform,appFolder);
							}
						});
						
					}					
				});
			});
		}
	});
}
//package module
function packModule(module,moduleName,appFolder,callBack) {
	modulesWaiting++;
	var modulePack = appFolder+"/"+config.deployFolder+"/"+moduleName+config.modulePackageExt;
	var exclude = {};
	walk(module,function(err,files) {
		if (err) {
			process.stdout.write('Error:' + err);
		} else {
			if (config.archiver == "node-native-zip") {
				var apack = require("node-native-zip");			
				var archive = new apack(modulePack);
				archive.addFiles(files, function (err) {
					if (err) {
						process.stdout.write("error while adding files: "+ err);
					} else {
						var buff = archive.toBuffer();
						fs.writeFile(modulePack, buff, function () {
							process.stdout.write("wrote "+modulePack+'\n');
							//compress the output file..
							var zlib = require('zlib');
							var gzip = zlib.createGzip();
							var inp = fs.createReadStream(modulePack);
							var out = fs.createWriteStream(modulePack+'.gz');
							out.on('close',function() {
								console.log("wrote ",modulePack+'.gz');
								if (config.delRawPackage) {
									fs.unlink(modulePack);
								}
							});
							inp.pipe(gzip).pipe(out);
							if (!--modulesWaiting) {
								modulesWritten();
								if (callBack) {
									callBack();
								}
							}
		
						});
					}
				});
			} else {
				if (config.archiver == "archiver") {
					var archiver = require("archiver");//alternative: zipstream-ctalkington
					var out = fs.createWriteStream(modulePack);
					var zip = archiver.createZip({ level: 1 });
					zip.pipe(out);
					var filepos=files.length;
					var addAnotherFile = function() {
						filepos--;
						if (filepos>-1) {
							//console.log(files[filepos].name);
							zip.addFile(fs.createReadStream(files[filepos].path), { name: files[filepos].name,store:false }, function() {
								addAnotherFile();
							});
						} else {
							zip.finalize(function(written) { 
								console.log("wrote "+modulePack+" "+Math.round(written/1024)+'k');
								if (!--modulesWaiting) {
									modulesWritten();
									if (callBack) {
										callBack();
									}
								}
							});
						}
					}
					addAnotherFile();
				}
			}
		}
	},exclude,false,true);
}
//Support function to scan dir recursively
var walk = function(dir, done, exclude, basePath, silent) {

  var results = [];
  if (!basePath) basePath = dir.length+1;
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
	  	  fs.stat(file, function(err, stat) {
			if (exclude[file.substring(basePath)]) {
				process.stdout.write("excluding:"+file.substring(basePath)+'\n');
				if (!--pending) done(null, results);
			} else {
		  
				if (stat && stat.isDirectory()) {
				  walk(file, function(err, res) {
					results = results.concat(res);
					if (!--pending) done(null, results);
				  },exclude, basePath, silent);
				} else {
					if (silent) {
					}else {
						process.stdout.write(file.substring(basePath)+'\n');
					}
					results.push({name:file.substring(basePath),path:file});
				  if (!--pending) done(null, results);
				}
			}
		  });
		 
    });
  });
};