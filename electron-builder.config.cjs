module.exports = {
  appId: 'com.voxflow.app',
  productName: 'VoxFlow',
  directories: { output: 'dist' },
  files: ['out/**/*'],
  win: {
    target: 'nsis',
    icon: 'resources/icon.png',
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  extraResources: [
    { from: 'src/native/dist', to: 'native', filter: ['*.exe'] },
    { from: 'resources/icon.png', to: 'icon.png' }
  ],
  publish: {
    provider: 'github',
    owner: 'MEHDImp4',
    repo: 'vibingtest',
    releaseType: 'release'
  }
}
