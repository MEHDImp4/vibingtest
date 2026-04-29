module.exports = {
  appId: 'com.voxflow.app',
  productName: 'VoxFlow',
  directories: { output: 'dist' },
  files: ['out/**/*', 'src/native/**/*'],
  win: {
    target: 'nsis',
    icon: 'resources/icon.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  extraResources: [
    { from: 'src/native', to: 'native', filter: ['**/*.py', 'requirements.txt'] },
    { from: 'resources/icon.png', to: 'icon.png' }
  ],
  publish: {
    provider: 'github',
    owner: 'MEHDImp4',
    repo: 'vibingtest',
    releaseType: 'release'
  }
}
