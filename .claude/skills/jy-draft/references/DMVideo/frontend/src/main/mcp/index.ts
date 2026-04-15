/**
 * MCP (Model Context Protocol) 服务模块
 * 提供本地服务接口，支持外部客户端调用
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DB } from '../database';

export class McpServer {
  private server: Server;
  private db: DB;
  private port: number;
  private running: boolean = false;

  constructor(port: number, db: DB) {
    this.port = port;
    this.db = db;

    this.server = new Server(
      {
        name: 'dmvideo-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // ==================== 材料库-文案 ====================
          {
            name: 'add_material_text',
            description: '添加文案到材料库',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: '文案内容' },
                source: { type: 'string', description: '来源：manual/input/rewrite' },
              },
              required: ['content'],
            },
          },
          {
            name: 'get_material_text_list',
            description: '获取材料库文案列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: '数量限制' },
                offset: { type: 'number', description: '偏移量' },
              },
            },
          },
          {
            name: 'delete_material_text',
            description: '删除材料库文案',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' }, description: '文案ID列表' },
              },
              required: ['ids'],
            },
          },

          // ==================== 材料库-视频 ====================
          {
            name: 'add_material_video',
            description: '添加视频到材料库',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: '视频文件路径' },
                file_name: { type: 'string', description: '文件名' },
                duration: { type: 'number', description: '时长(秒)' },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'get_material_video_list',
            description: '获取材料库视频列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
              },
            },
          },
          {
            name: 'delete_material_video',
            description: '删除材料库视频',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' } },
              },
              required: ['ids'],
            },
          },

          // ==================== 材料库-作品地址 ====================
          {
            name: 'add_material_url',
            description: '添加作品地址到材料库',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: '作品地址' },
                platform: { type: 'string', description: '平台：dy/xhs' },
                content_type: { type: 'string', description: '类型：video/image' },
              },
              required: ['url'],
            },
          },
          {
            name: 'get_material_url_list',
            description: '获取材料库作品地址列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
              },
            },
          },
          {
            name: 'delete_material_url',
            description: '删除材料库作品地址',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' } },
              },
              required: ['ids'],
            },
          },

          // ==================== 素材库-文案 ====================
          {
            name: 'add_draft_text',
            description: '添加文案到素材库',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: '文案内容' },
              },
              required: ['content'],
            },
          },
          {
            name: 'get_draft_text_list',
            description: '获取素材库文案列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
              },
            },
          },
          {
            name: 'delete_draft_text',
            description: '删除素材库文案',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' } },
              },
              required: ['ids'],
            },
          },

          // ==================== 素材库-视频 ====================
          {
            name: 'add_draft_video',
            description: '添加视频到素材库',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: '视频文件路径' },
                file_name: { type: 'string' },
                keywords: { type: 'string', description: '关键词(JSON数组)' },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'get_draft_video_list',
            description: '获取素材库视频列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
              },
            },
          },
          {
            name: 'update_draft_video_analysis',
            description: '更新素材视频分析结果',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                keywords: { type: 'string' },
              },
              required: ['id', 'keywords'],
            },
          },
          {
            name: 'delete_draft_video',
            description: '删除素材库视频',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' } },
              },
              required: ['ids'],
            },
          },

          // ==================== 作品库 ====================
          {
            name: 'add_work',
            description: '添加作品到作品库',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: '作品文件路径' },
                platform: { type: 'string', description: '发布平台' },
                platform_url: { type: 'string', description: '平台地址' },
                remark: { type: 'string', description: '备注' },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'get_work_list',
            description: '获取作品列表',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' },
              },
            },
          },
          {
            name: 'update_work_stats',
            description: '更新作品数据（播放量、点赞等）',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                play_count: { type: 'number' },
                like_count: { type: 'number' },
                comment_count: { type: 'number' },
                share_count: { type: 'number' },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_work',
            description: '删除作品',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'number' } },
              },
              required: ['ids'],
            },
          },

          // ==================== 配置 ====================
          {
            name: 'get_config',
            description: '获取配置项',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: '配置键名' },
              },
              required: ['key'],
            },
          },
          {
            name: 'set_config',
            description: '设置配置项',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['key', 'value'],
            },
          },
          {
            name: 'get_all_configs',
            description: '获取所有配置',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 确保args不为undefined
      const params = args || {};

      try {
        let result: any;

        switch (name) {
          // 材料库-文案
          case 'add_material_text':
            result = { id: this.db.addMaterialText(params.content as string, params.source as string) };
            break;
          case 'get_material_text_list':
            result = this.db.getMaterialTextList(params.limit as number, params.offset as number);
            break;
          case 'delete_material_text':
            result = { changes: this.db.deleteMaterialText(params.ids as number[]) };
            break;

          // 材料库-视频
          case 'add_material_video':
            result = { id: this.db.addMaterialVideo(params as any) };
            break;
          case 'get_material_video_list':
            result = this.db.getMaterialVideoList(params.limit as number, params.offset as number);
            break;
          case 'delete_material_video':
            result = { changes: this.db.deleteMaterialVideo(params.ids as number[]) };
            break;

          // 材料库-作品地址
          case 'add_material_url':
            result = { id: this.db.addMaterialUrl(params as any) };
            break;
          case 'get_material_url_list':
            result = this.db.getMaterialUrlList(params.limit as number, params.offset as number);
            break;
          case 'delete_material_url':
            result = { changes: this.db.deleteMaterialUrl(params.ids as number[]) };
            break;

          // 素材库-文案
          case 'add_draft_text':
            result = { id: this.db.addDraftText(params.content as string) };
            break;
          case 'get_draft_text_list':
            result = this.db.getDraftTextList(params.limit as number, params.offset as number);
            break;
          case 'delete_draft_text':
            result = { changes: this.db.deleteDraftText(params.ids as number[]) };
            break;

          // 素材库-视频
          case 'add_draft_video':
            result = { id: this.db.addDraftVideo(params as any) };
            break;
          case 'get_draft_video_list':
            result = this.db.getDraftVideoList(params.limit as number, params.offset as number);
            break;
          case 'update_draft_video_analysis':
            result = { changes: this.db.updateDraftVideoAnalysis(params.id as number, params.keywords as string) };
            break;
          case 'delete_draft_video':
            result = { changes: this.db.deleteDraftVideo(params.ids as number[]) };
            break;

          // 作品库
          case 'add_work':
            result = { id: this.db.addWork(params as any) };
            break;
          case 'get_work_list':
            result = this.db.getWorkList(params.limit as number, params.offset as number);
            break;
          case 'update_work_stats':
            result = { changes: this.db.updateWorkStats(params.id as number, params as any) };
            break;
          case 'delete_work':
            result = { changes: this.db.deleteWork(params.ids as number[]) };
            break;

          // 配置
          case 'get_config':
            result = { value: this.db.getConfig(params.key as string) };
            break;
          case 'set_config':
            this.db.setConfig(params.key as string, params.value as string);
            result = { success: true };
            break;
          case 'get_all_configs':
            result = this.db.getAllConfigs();
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error.message }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * 启动 MCP 服务
   */
  async start(): Promise<void> {
    if (this.running) return;

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.running = true;
    console.log('[MCP] 服务已启动');
  }

  /**
   * 停止 MCP 服务
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    await this.server.close();
    this.running = false;
    console.log('[MCP] 服务已停止');
  }
}