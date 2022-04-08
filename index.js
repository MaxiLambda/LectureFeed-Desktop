const {app, BrowserWindow, globalShortcut, dialog} = require('electron');
const path = require('path')
const kill = require("tree-kill");

let mainWindow = null;
let serverProcess = null;
let expectedKill = false;

app.allowRendererProcessReuse = true;

// Provide API for web application
global.callElectronUiApi = function () {
    console.log('Electron called from web app with args "' + JSON.stringify(arguments) + '"');

    if (arguments) {
        switch (arguments[0]) {
            case 'exit':
                console.log('Kill server process');
                expectedKill = true;

                const kill = require('tree-kill');
                kill(serverProcess.pid, 'SIGTERM', function () {
                    console.log('Server process killed');

                    serverProcess = null;

                    if (mainWindow !== null) {
                        mainWindow.close();
                    }
                });
                break;
            case 'minimize':
                mainWindow.minimize();
                break;
            case 'maximize':
                if (!mainWindow.isMaximized()) {
                    mainWindow.maximize();
                } else {
                    mainWindow.unmaximize();
                }
                break;
            case 'devtools':
                mainWindow.webContents.openDevTools();
                break;
        }
    }
};

app.on('window-all-closed', function () {
    app.quit();
});

app.on('ready', function () {
    platform = process.platform;

    serverProcess = require('child_process')
        .spawn('java', ['-jar', path.join(__dirname, 'resources', 'LectureFeed-0.0.1-SNAPSHOT.jar')],
            {
                cwd: path.join(__dirname, 'resources')
            });

    if (!serverProcess) {
        console.error('Unable to start server from ' + __dirname);
        app.quit();
        return;
    }

    serverProcess.stdout.on('data', function (data) {
        // process.stdout.write('Server: ' + data);
    });
    serverProcess.stderr.on('data', function (data) {
        // process.stderr.write('Server error: ' + data);
    });

    serverProcess.on('exit', code => {
        if (expectedKill) return;
        serverProcess = null;

        if (code !== 0) {
            console.error(`Server stopped unexpectedly with code ${code}`);
            dialog.showErrorBox("An error occurred", "The server stopped unexpectedly, app will close.");
        }
        if (mainWindow !== null) {
            mainWindow.close();
        }
    });

    console.log("Server PID: " + serverProcess.pid);

   const appUrl = 'http://localhost:8080/#/presenter';

   const openWindow = function () {
        mainWindow = new BrowserWindow({
            icon: path.join(__dirname, 'resources', 'icons', 'favicon.ico'),
            title: 'LectureFeed',
            width: 500,
            height: 768,
            frame: true,
            backgroundColor: '#14B8A6',
            webPreferences: {nodeIntegration: true}
        });
        mainWindow.loadURL(appUrl);

        mainWindow.on('closed', function () {
            mainWindow = null;
        });

        mainWindow.on('close', function (e) {
            if (serverProcess !== null) {
                //e.preventDefault();
                kill(serverProcess.pid, 'SIGTERM', function () {
                    console.log('Server process killed');
                    serverProcess = null;
                });
            }
        });
    };

    const startUp = function () {
        const requestPromise = require('minimal-request-promise');

        requestPromise.get(appUrl).then(function (response) {
            console.log('Server started!');
            openWindow();
        }, function (response) {
            //console.log(response)
            console.log('Waiting for the server start...');

            setTimeout(function () {
                startUp();
            }, 1000);
        });
    };

    setTimeout(function () { startUp()}, 2000);

    // Register a shortcut listener.
    globalShortcut.register('CommandOrControl+Shift+`', () => {
        console.log('Bring to front shortcut triggered');
        if (mainWindow) {
            mainWindow.focus();
        }
    })
});

app.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});