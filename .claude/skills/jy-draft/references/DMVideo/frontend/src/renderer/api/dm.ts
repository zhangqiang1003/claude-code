/**
 * 统一 API 导出
 * 基于 axios 封装，对应原 uni-app 的 sys.request 接口
 */

export * from './request';

// 导出各模块 API
export * as authApi from './modules/auth';

// 默认导出所有 API 的统一对象
export const api = {
    auth: {
        login: (...args: Parameters<typeof import('./modules/auth').login>) =>
            import('./modules/auth').then(m => m.login(...args)),
        register: (...args: Parameters<typeof import('./modules/auth').register>) =>
            import('./modules/auth').then(m => m.register(...args)),
        createUser: (...args: Parameters<typeof import('./modules/auth').createUser>) =>
            import('./modules/auth').then(m => m.createUser(...args)),
        checkUser: (...args: Parameters<typeof import('./modules/auth').checkUser>) =>
            import('./modules/auth').then(m => m.checkUser(...args)),
        forgetPassword: (...args: Parameters<typeof import('./modules/auth').forgetPassword>) =>
            import('./modules/auth').then(m => m.forgetPassword(...args)),
        sendSms: (...args: Parameters<typeof import('./modules/auth').sendSms>) =>
            import('./modules/auth').then(m => m.sendSms(...args)),
        getCaptcha: (...args: Parameters<typeof import('./modules/auth').getCaptcha>) =>
            import('./modules/auth').then(m => m.getCaptcha(...args)),
        verifyCaptcha: (...args: Parameters<typeof import('./modules/auth').verifyCaptcha>) =>
            import('./modules/auth').then(m => m.verifyCaptcha(...args)),
    }
};
