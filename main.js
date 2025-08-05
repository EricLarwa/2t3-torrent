import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, 'preload.cjs') // Note: .cjs extension
        },
        icon: join(__dirname, 'assets/icon.png') // Optional
    })

    mainWindow.loadFile('src/gui/index.html')
    
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools()
    }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Handle file selection
ipcMain.handle('select-torrent-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Torrent Files', extensions: ['torrent'] }
        ]
    })
    
    return result.filePaths[0]
})

// Handle download location selection
ipcMain.handle('select-download-location', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
        properties: ['createDirectory']
    })
    
    return result.filePath
})

// Handle torrent download
ipcMain.handle('start-download', async (event, torrentPath, downloadPath) => {
    try {
        // Import your ES modules
        const torrentParser = await import('./src/BitProcess/torrent-parser.js')
        const download = await import('./src/BitProcess/download.js')
        
        const torrent = torrentParser.default.open(torrentPath)
        
        // Start download and send progress updates
        download.default(torrent, downloadPath, (progress) => {
            mainWindow.webContents.send('download-progress', progress)
        })
        
        return { success: true }
    } catch (error) {
        console.error('Download error:', error)
        return { success: false, error: error.message }
    }
})