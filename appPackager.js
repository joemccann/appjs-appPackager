var config = {
	packageExt:'.appjs'
}

if (process.argv.length < 3) {
	console.log("node.exe appPackager <folder to pack or package to unpack>");
	process.exit(1);
}
var fs = require("fs");
var path = require("path");

var appPackage = "";
var modulesWaiting = 0;
var modulesWritten = function() {
	console.log("modules written");
	appInfo.packageVer = appInfo.packageVer+1;
	
	fs.writeFile(appFolder+"/appInfo.json",JSON.stringify(appInfo, null,4),function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log("wrote "+appFolder+"/appInfo.json");
		}
		packageApp();
	});
}
var appInfo = {
	appName:"Unnamed"
	,packageVer:0
	,appVersion:0.1
	,deps:{
	
	}
};
var appFolder = './';
				
fs.stat(process.argv[2], function(err, stats) {
	if (err) {
		console.log(err);
		process.exit(1);
	}
	if (stats.isDirectory()) {
		appFolder = process.argv[2];
		appPackage = appFolder + config.packageExt;
		fs.exists(appFolder+"/appinfo.json",function(exists) {
			if (!exists) {
			console.log("no appinfo.json found");
			console.log(appFolder+"/appinfo.json");
				appInfo.appName=path.basename(appFolder);
				scanModules();
				
			} else {
				fs.readFile(appFolder+"/appinfo.json", 'utf8', function (err,data) {
				  if (err) {
					console.log(err);
				  } else {
					appInfo = JSON.parse(data);
				  }
					scanModules();
				});
			}
		});
	}
	if (stats.isFile()) {
		var apack = require('./adm-zip');
		appPackage = process.argv[2];
		appFolder = appPackage.substring(0,appPackage.lastIndexOf('.'));
		process.stdout.write("unpacking "+appPackage+'\n');
		var archive = new apack(appPackage);
		archive.extractAllTo(appFolder, true);
		process.stdout.write("unpackaged to "+appFolder+'\n');
	}
});

function packageApp() {
	process.stdout.write('scanning folder: '+appFolder+'\n');
	var exclude= {
		'bin':'bin'
		,'node_modules':'node_modules'
	}
	walk(appFolder,function(err,files) {
		if (err) {
			process.stdout.write('Error:' + err);
		} else {
			var apack = require("./node-native-zip");
			
			var archive = new apack(appPackage);
				archive.addFiles(files, function (err) {
					if (err) {
						process.stdout.write("error while adding files: "+ err);
					} else {
						var buff = archive.toBuffer();
						fs.writeFile(appPackage, buff, function () {
							process.stdout.write("wrote "+appPackage+'\n');
						});
					}
				});
		}
	},exclude);
}


function scanModules() {
//scan node modules
	console.log("scanning node_modules");
	fs.readdir("./"+appFolder+"/node_modules", function(err, list) {
		if (err) {console.log(err);throw err;}
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
							  var config = JSON.parse(data);
							  if (!appInfo.deps[config.name]) appInfo.deps[config.name] = {};
							  
							  appInfo.deps[config.name].name = config.name;
							  appInfo.deps[config.name].version = config.version;
							  if (!appInfo.deps[config.name]['platforms']) appInfo.deps[config.name].platforms = {};
							  appInfo.deps[config.name].platforms[process.platform] = process.platform;
							  
							  
							  packModule(module,config.name+"-"+config.version+"-"+process.platform,appFolder);
							  
							});
						} else {
							packModule(module,file+"."+process.platform,appFolder);
						}
					});
					
				}					
			});
		});
	});
}
//package module
function packModule(module,moduleName,appFolder) {
	modulesWaiting++;
	var modulePack = appFolder+"/node_modules/"+moduleName+".modpack";
	var exclude = {};
	walk(module,function(err,files) {
		if (err) {
			process.stdout.write('Error:' + err);
		} else {
			var apack = require("./node-native-zip");			
			var archive = new apack(modulePack);
			archive.addFiles(files, function (err) {
				if (err) {
					process.stdout.write("error while adding files: "+ err);
				} else {
					var buff = archive.toBuffer();
					fs.writeFile(modulePack, buff, function () {
						process.stdout.write("wrote "+modulePack+'\n');
						
						if (!--modulesWaiting) {modulesWritten();}
	
					});
				}
			});
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