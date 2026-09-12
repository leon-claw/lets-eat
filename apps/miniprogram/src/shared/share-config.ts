export const HOME_SHARE_PATH = '/pages/home/index';
export const SHARE_TITLE = '今天吃什么';

export interface MiniProgramShareConfig {
  onShareAppMessage(): {
    title: string;
    path: string;
  };
  onShareTimeline(): {
    title: string;
    query: string;
  };
}

export function createShareConfig(): MiniProgramShareConfig {
  return {
    onShareAppMessage() {
      return {
        title: SHARE_TITLE,
        path: HOME_SHARE_PATH,
      };
    },
    onShareTimeline() {
      return {
        title: SHARE_TITLE,
        query: '',
      };
    },
  };
}
