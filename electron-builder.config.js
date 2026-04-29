module.exports = {
  appId: 'com.voxflow.app',
  productName: 'VoxFlow',
  directories: { output: 'dist' },
  files: ['out/**/*', 'src/native/**/*'],
  win: {
    target: 'nsis',
    icon: 'resources/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  extraResources: [
    { from: 'src/native', to: 'native', filter: ['**/*.py', 'requirements.txt'] }
  ],
  publish: {
    provider: 'github',
    owner: 'MEHDImp4',
    repo: 'vibingtest'
  }
}
