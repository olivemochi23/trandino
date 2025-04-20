import { ChannelManager } from '../services/channel-manager.js';
import fs from 'fs/promises';
import path from 'path';
import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';

describe('ChannelManager', () => {
  let manager;
  let mockConfigData;
  
  beforeEach(() => {
    // モックデータのリセット
    mockConfigData = {
      'guild1': {
        channels: ['channel1', 'channel2'],
        enabled: true,
        last_updated: '2023-11-10T12:34:56Z',
        updated_by: 'user1'
      },
      'guild2': {
        channels: ['channel3'],
        enabled: false,
        last_updated: '2023-11-09T09:12:34Z',
        updated_by: 'user2'
      }
    };
    
    // fs 関数のモックを beforeEach 内で設定
    fs.readFile = jest.fn().mockImplementation((filePath, encoding) => {
      if (filePath.endsWith('channels.json')) {
        return Promise.resolve(JSON.stringify(mockConfigData));
      }
      // ENOENTエラーをシミュレートするテストのために、特定のエラーを返す場合も用意
      if (filePath === 'nonexistent/channels.json') {
         const error = new Error('File not found');
         error.code = 'ENOENT';
         return Promise.reject(error);
      }
      return Promise.reject(new Error(`Unexpected file read: ${filePath}`));
    });
    fs.writeFile = jest.fn().mockResolvedValue();
    fs.mkdir = jest.fn().mockResolvedValue();
    
    // マネージャーの初期化
    manager = new ChannelManager({
      dataDir: './test-data'
    });
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  describe('loadConfig', () => {
    test('設定を正しく読み込めること', async () => {
      const config = await manager.loadConfig();
      
      expect(config).toEqual(mockConfigData);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledWith(path.join('./test-data', 'channels.json'), 'utf-8');
    });
    
    test('ファイルが存在しない場合は空オブジェクトを返すこと', async () => {
      // loadConfig 内でENOENTをハンドルするか確認するため、特定のパスでENOENTを返すようにモックを上書き
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.endsWith('channels.json')) {
           const error = new Error('File not found');
           error.code = 'ENOENT';
           return Promise.reject(error);
        }
        return Promise.reject(new Error(`Unexpected file read: ${filePath}`));
      });

      const config = await manager.loadConfig();
      
      expect(config).toEqual({});
      expect(fs.writeFile).toHaveBeenCalledTimes(1); // 空の設定を保存
      expect(fs.writeFile).toHaveBeenCalledWith(path.join('./test-data', 'channels.json'), '{}', 'utf-8');
    });
  });
  
  describe('saveConfig', () => {
    test('設定を正しく保存できること', async () => {
      const newConfig = { ...mockConfigData };
      newConfig.guild3 = {
        channels: ['channel4'],
        enabled: true,
        last_updated: '2023-11-11T10:20:30Z',
        updated_by: 'user3'
      };
      
      await manager.saveConfig(newConfig);
      
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 正しい引数で呼ばれたかチェック
      const [filePath, content, encoding] = fs.writeFile.mock.calls[0];
      expect(filePath).toEqual(path.join('./test-data', 'channels.json'));
      expect(JSON.parse(content)).toEqual(newConfig);
      expect(encoding).toEqual('utf-8');
    });
  });
  
  describe('isEnabledChannel', () => {
    test('有効なチャンネルを正しく判定すること', async () => {
      const result = await manager.isEnabledChannel('guild1', 'channel1');
      
      expect(result).toBe(true);
    });
    
    test('無効化されたギルドのチャンネルはfalseを返すこと', async () => {
      const result = await manager.isEnabledChannel('guild2', 'channel3');
      
      expect(result).toBe(false);
    });
    
    test('存在しないチャンネルはfalseを返すこと', async () => {
      const result = await manager.isEnabledChannel('guild1', 'channel999');
      
      expect(result).toBe(false);
    });
    
    test('存在しないギルドはfalseを返すこと', async () => {
      const result = await manager.isEnabledChannel('guild999', 'channel1');
      
      expect(result).toBe(false);
    });
    
    test('無効なパラメータはfalseを返すこと', async () => {
      const result1 = await manager.isEnabledChannel(null, 'channel1');
      const result2 = await manager.isEnabledChannel('guild1', null);
      const result3 = await manager.isEnabledChannel('', '');
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });
  
  describe('getEnabledChannels', () => {
    test('有効なギルドのチャンネルリストを取得できること', async () => {
      const channels = await manager.getEnabledChannels('guild1');
      
      expect(channels).toEqual(['channel1', 'channel2']);
    });
    
    test('無効化されたギルドは空配列を返すこと', async () => {
      const channels = await manager.getEnabledChannels('guild2');
      
      expect(channels).toEqual([]);
    });
    
    test('存在しないギルドは空配列を返すこと', async () => {
      const channels = await manager.getEnabledChannels('guild999');
      
      expect(channels).toEqual([]);
    });
  });
  
  describe('addChannel', () => {
    test('新しいチャンネルを追加できること', async () => {
      await manager.addChannel('guild1', 'channel3', 'user1');
      
      // 設定が保存されたことを確認
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 引数の確認
      const [, content] = fs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content);
      
      expect(savedConfig.guild1.channels).toContain('channel3');
      expect(savedConfig.guild1.updated_by).toBe('user1');
    });
    
    test('存在しないギルドに追加すると新しく作成されること', async () => {
      await manager.addChannel('guild3', 'channel1', 'user3');
      
      // 設定が保存されたことを確認
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 引数の確認
      const [, content] = fs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content);
      
      expect(savedConfig.guild3).toBeDefined();
      expect(savedConfig.guild3.channels).toContain('channel1');
      expect(savedConfig.guild3.enabled).toBe(true);
    });
    
    test('すでに追加されているチャンネルは重複して追加されないこと', async () => {
      await manager.addChannel('guild1', 'channel1', 'user1');
      
      // 設定が保存されたことを確認
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 引数の確認
      const [, content] = fs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content);
      
      expect(savedConfig.guild1.channels).toEqual(['channel1', 'channel2']);
    });
  });
  
  describe('removeChannel', () => {
    test('チャンネルを削除できること', async () => {
      await manager.removeChannel('guild1', 'channel1', 'user1');
      
      // 設定が保存されたことを確認
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 引数の確認
      const [, content] = fs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content);
      
      expect(savedConfig.guild1.channels).not.toContain('channel1');
      expect(savedConfig.guild1.channels).toContain('channel2');
      expect(savedConfig.guild1.updated_by).toBe('user1');
    });
    
    test('存在しないチャンネルを削除しようとしても変更されないこと', async () => {
      await manager.removeChannel('guild1', 'channel999', 'user1');
      
      // 設定が保存されたことを確認
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      
      // 引数の確認
      const [, content] = fs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content);
      
      expect(savedConfig.guild1.channels).toEqual(['channel1', 'channel2']);
    });
    
    test('存在しないギルドを削除しようとするとnullを返すこと', async () => {
      const result = await manager.removeChannel('guild999', 'channel1', 'user1');
      
      expect(result).toBeNull();
    });
  });
}); 