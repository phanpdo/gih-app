const { app, BrowserWindow, Menu, MenuItem, nativeImage } = require('electron');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require("path");

app.commandLine.appendSwitch('ignore-certificate-errors');
const isWindows = os.platform() === 'win32';
const localServerDir = './resources/local_server';
cmd = `local_server${isWindows? '.exe 1':''}`;
console.log('CMD: ', cmd);
let localHostProcess = exec(cmd, { cwd: localServerDir }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }

    console.log(`Standard Output:\n${stdout}`);
    console.error(`Standard Error:\n${stderr}`);
});
console.log('PID: ', localHostProcess.pid);

function setMenu() {
    const defaultMenu = Menu.getApplicationMenu();
    defaultMenu.items[0].submenu.insert(0,
        new MenuItem({
            label: 'Settings',
            icon: nativeImage.createFromPath(path.join(__dirname, 'resources/local_server/settings.png')),
            click: () => {
                console.log('Settings')
            },
        })
    );
    Menu.setApplicationMenu(defaultMenu);
}
function createWindow() {
    setMenu();
    // Create a new browser window
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true, // Enable Node.js integration
        },
    });
    fs.readFile(`${localServerDir}/config.json`, 'utf8', (err, data) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        try {
            const config = JSON.parse(data);
            console.log(config);
            win.loadURL(`https://localhost:${config.port}`);
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });
}

app.whenReady().then(createWindow);

app.on('before-quit', (event) => {
    localHostProcess.kill();
    fs.readdir('resources/local_server', (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        const pidFiles = files.filter((file) => path.extname(file) === '.pid');

        if (pidFiles.length === 0) {
            console.log('No .pid files found in the directory.');
        } else {
            console.log('Found .pid files:');
            let pid = pidFiles.pop().split('.')[0];
            console.log('kill ', pid);
            exec(isWindows ? `taskkill /F /PID ${pid}` : `kill ${pid}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error killing process with PID ${pid}: ${error.message}`);
                    return;
                }

                if (stderr) {
                    console.error(`Error killing process with PID ${pid}: ${stderr}`);
                    return;
                }

                console.log(`Process with PID ${pid} has been successfully killed.`);
            });
        }
    });
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
