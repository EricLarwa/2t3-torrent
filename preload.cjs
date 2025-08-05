const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    selectTorrentFile: () => ipcRenderer.invoke('select-torrent-file'),
    selectDownloadLocation: () => ipcRenderer.invoke('select-download-location'),
    startDownload: (torrentPath, downloadPath) => 
        ipcRenderer.invoke('start-download', torrentPath, downloadPath),
    onDownloadProgress: (callback) => 
        ipcRenderer.on('download-progress', callback)
})