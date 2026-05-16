const path = require('path');
const globModule = require('glob');
const glob = globModule.default || globModule.glob || globModule;

require('reflect-metadata');

const tsNode = require('ts-node');
tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    emitDecoratorMetadata: true,
    experimentalDecorators: true,
    target: 'ES2023',
  }
});

const srcDir = path.resolve('C:\\mfg-platform_copy\\backend', 'src', 'config');
const pattern = srcDir + '/../**/*.entity.ts';

glob(pattern).then(async files => {
  console.log('Matched:', files.length);
  
  // Resolve to absolute paths
  const absFiles = files.map(f => path.resolve('C:\\mfg-platform_copy\\backend', f));
  const permFile = absFiles.find(f => f.includes('sys-permission'));
  
  if (permFile) {
    console.log('Loading:', permFile);
    try {
      const mod = require(permFile);
      console.log('Module keys:', Object.keys(mod));
      const SysPermission = mod.SysPermission;
      console.log('SysPermission:', SysPermission ? SysPermission.name : 'NOT FOUND');
      if (SysPermission) {
        console.log('Metadata keys:', Reflect.getMetadataKeys(SysPermission));
        const entityMeta = Reflect.getMetadata('typeorm:Entity', SysPermission);
        console.log('Entity metadata:', entityMeta);
      }
    } catch(e) {
      console.log('Load failed:', e.message);
      console.log(e.stack);
    }
  }
}).catch(err => console.error('Glob error:', err));
