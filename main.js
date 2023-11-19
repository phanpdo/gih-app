const { app, BrowserWindow, Menu, MenuItem, nativeImage, ipcMain } = require('electron');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require("path");
const logger = require('./logger');
const React = require('react');
const ReactDOM = require('react-dom');
const STATION_TYPE = {
    master: "MASTER",
    score_card: "SC",
    weight_in: "WI",
    camera: "CA",
    bracket: "BR",
}

let win;
let localServerError = false;

app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('ignore-certificate-errors');
const isWindows = os.platform() === 'win32';
const localServerDir = './resources/local_server';
let localHostProcess;
let config;
loadConfig();

function restartServer() {
    logger.info('Restarting server...');
    localServerError = false;
    stopServer(() => {
        startServer();
        loadServerURL();
    });
}

function stopServer(callback) {
    logger.info('Stopping server...');
    localHostProcess.kill();
    fs.readdir('resources/local_server', (err, files) => {
        if (err) {
            logger.error('Error reading directory:', err);
            return;
        }

        const pidFiles = files.filter((file) => path.extname(file) === '.pid');

        if (pidFiles.length === 0) {
            logger.info('No .pid files found in the directory.');
            callback();
        } else {
            logger.info('Found .pid files:');
            let pid = pidFiles.pop().split('.')[0];
            logger.info(`kill ${pid}`);
            exec(isWindows ? `taskkill /F /PID ${pid}` : `kill ${pid}`, (error, stdout, stderr) => {
                try {
                    if (error) {
                        logger.error(`Error killing process with PID ${pid}: ${error.message}`);
                        return;
                    }

                    if (stderr) {
                        logger.error(`Error killing process with PID ${pid}: ${stderr}`);
                        return;
                    }

                    logger.info(`Process with PID ${pid} has been successfully killed.`);
                } finally {
                    localHostProcess.kill();
                    callback();
                }
            });
        }
    });
}

function setStation(data=config) {
    const { station_type=STATION_TYPE.master } = data;
    if (station_type === STATION_TYPE.master) {
        if (config.port !== data.port || config.graphql_server_url !== data.graphql_server_url) {
            let configPath = `${localServerDir}/config.json`;
            restartServer();
        }else if (!localHostProcess){
            startServer();
        }
    } else if (station_type === STATION_TYPE.camera) {
        let cameraPath = `file://${path.join(__dirname, 'camera.html')}`;
        win.loadURL(`${cameraPath}?score_card=${data.camer_score_card}&device_id=${data.camera_device}`);
    } else {
        win.loadURL(`https://localhost:${config.port}/local/${config.station_type}`);
    }
}

function updateApp(data) {
    try{
        setStation(data);
    }finally{
        let c = { ...config, port: data.port };
        saveFile(configPath, JSON.stringify(c));
    }
}

function serverMessage(data) {
    const messagMap = { port_not_available: 'port_not_available: ' };
    let messageHTML = fs.readFileSync(`message.html`).toString();
    if (data.startsWith(messagMap.port_not_available)) {
        localServerError = true;
        messageHTML = messageHTML.replace('$message',
            `Port ${data.split(messagMap.port_not_available)[1]} is not available. Go
             to Settings from the File menu and change the master port number.  Or select to run as a station.`);
        win.loadURL(`data:text/html,${encodeURIComponent(messageHTML)}`);
    } else if (data === 'local_server_up') {
        loadServerURL();
    }
}

function startServer() {
    logger.info('Launching local server...');
    cmd = `local_server${isWindows ? '.exe 1' : ''}`;
    logger.info(`CMD: ${cmd}`);
    localHostProcess = exec(cmd, { cwd: localServerDir }, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Error: ${error}`);
            return;
        }

        logger.info(`Standard Output:\n${stdout}`);
        logger.error(`Standard Error:\n${stderr}`);
    });
    localHostProcess.stdout.on('data', (data) => {
        logger.info(data);
        const electronKey = 'electron:';
        if (data.includes(electronKey)) {
            for (let l of data.split('\n')) {
                if (l.startsWith(electronKey)) {
                    let d = JSON.parse(l.split(electronKey)[1]);
                    if (d.message === 'updateApp') {
                        updateApp(d.data);
                    } else if (d.message === 'serverMessage') {
                        serverMessage(d.data);
                    }
                }
            }
        }
    });
    logger.info(`PID: ${localHostProcess.pid}`);
}

function getLocalIp() {
    // Get the network interfaces
    const networkInterfaces = os.networkInterfaces();

    // Find the local IPv4 address
    let localIP;

    for (const interfaceName in networkInterfaces) {
        const interface = networkInterfaces[interfaceName];

        for (const info of interface) {
            if (info.family === 'IPv4' && !info.internal) {
                localIP = info.address;
                break;
            }
        }

        if (localIP) {
            break;
        }
    }

    if (localIP) {
        logger.info(`Local IP address: ${localIP}`);
    } else {
        logger.info('Local IP address not found');
    }
    return localIP;
}

function setMenu() {
    const defaultMenu = Menu.getApplicationMenu();
    defaultMenu.items[0].submenu.insert(0,
        new MenuItem({
            label: 'App Settings',
            icon: nativeImage.createFromPath(path.join(__dirname, 'resources/local_server/settings.png')),
            click: () => {
                let stationType = config.station_type || STATION_TYPE.master;
                stationType = localServerError ? STATION_TYPE.master : stationType;
                let settingsPath = `file://${path.join(__dirname, 'settings.html')}`;
                win.loadURL(`${settingsPath}?localServerError=${localServerError}&port=${config.port}&station_type=${stationType}`);
            },
        })
    );
    Menu.setApplicationMenu(defaultMenu);
}

function saveFile(filePath, data) {
    try {
        // Write data to the file synchronously
        fs.writeFileSync(filePath, data);
        logger.info('Data has been written to the file.');
    } catch (err) {
        logger.error('Error writing to the file:', err);
    }
}

function loadConfig() {
    let configPath = `${localServerDir}/config.json`;
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info(JSON.stringify(config));
    return config;
}

function loadServerURL() {
    try {
        !localServerError && win.loadURL(`https://localhost:${config.port}?fromApp=true`);
        let masterUrl = `https://${getLocalIp()}:${config.port}`;
        config.master_url = masterUrl;
        setTimeout(() => {
            win.setTitle(`GIH - ${masterUrl}`);
        }, 4000);
        fs.writeFile(configPath, JSON.stringify(config, null, 2), (err) => {
            if (err) {
                logger.error('Error writing to the config file:', err);
            } else {
                logger.info('Text has been written to the config file.');
            }
        });
    } catch (error) {
        logger.error('Error parsing JSON:', error);
    }
}

function createWindow() {
    setStation();
    setMenu();
    // Create a new browser window
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // Enable Node.js integration
            webSecurity: false, // Allow loading local resources
            preload: path.join(__dirname, 'preload.js')
        },
    });
    win.maximize();
    // Listen for messages from the renderer process
    ipcMain.on('message-from-renderer', (event, data) => {
        console.log('Message from renderer process:', data);
        if (data.message === 'updateApp') {
            updateApp({ ...config, ...data});
        } else if (data.message === 'cancelSettings') {
            setStation();
        }
        // Reply to the renderer process
        event.sender.send('message-from-main', 'Hello from main process!');
    });
}

app.whenReady().then(createWindow);

app.on('before-quit', (event) => {
    stopServer();
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle activate event (macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
