import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

// 布局组件
import MainLayout from '../layouts/MainLayout.vue';

/**
 * 路由配置
 * DMVideo 视频处理生成工具
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/material/video',
    children: [
      // ==================== 材料库 ====================
      // {
      //   path: '/material/text',
      //   name: 'MaterialText',
      //   component: () => import('../views/material/text.vue'),
      //   meta: {
      //     title: '文案',
      //     icon: 'Document',
      //     category: 'material',
      //   },
      // },
      {
        path: '/material/video',
        name: 'MaterialVideo',
        component: () => import('../views/material/video.vue'),
        meta: {
          title: '视频',
          icon: 'VideoCamera',
          category: 'material',
        },
      },
      // {
      //   path: '/material/url',
      //   name: 'MaterialUrl',
      //   component: () => import('../views/material/url.vue'),
      //   meta: {
      //     title: '作品地址',
      //     icon: 'Link',
      //     category: 'material',
      //   },
      // },

      // ==================== 素材库 ====================
      {
        path: '/draft/text',
        name: 'DraftText',
        component: () => import('../views/draft/text.vue'),
        meta: {
          title: '文案',
          icon: 'Document',
          category: 'draft',
        },
      },
      {
        path: '/draft/video',
        name: 'DraftVideo',
        component: () => import('../views/draft/video.vue'),
        meta: {
          title: '视频',
          icon: 'VideoCamera',
          category: 'draft',
        },
      },

      // ==================== 作品库 ====================
      // {
      //   path: '/works',
      //   name: 'Works',
      //   component: () => import('../views/works/index.vue'),
      //   meta: {
      //     title: '作品',
      //     icon: 'Folder',
      //     category: 'works',
      //   },
      // },

      // ==================== 基本配置 ====================
      {
        path: '/config',
        name: 'Config',
        component: () => import('../views/config/index.vue'),
        meta: {
          title: '基本配置',
          icon: 'Setting',
          category: 'config',
        },
      },

      // ==================== 联系我 ====================
      {
        path: '/contact',
        name: 'Contact',
        component: () => import('../views/contact/index.vue'),
        meta: {
          title: '联系我',
          icon: 'ChatDotRound',
          category: 'contact',
        },
      },
    ],
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  console.log(`[Router] 导航至: ${to.path} - ${to.meta?.title}`);

  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - DMVideo`;
  }

  next();
});

// 路由后置钩子
router.afterEach((to) => {
  console.log(`[Router] 导航完成: ${to.path}`);
});

export default router;
