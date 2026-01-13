export type Group = {
  id: string;
  name: string;
  order: number;
  enabled?: boolean;
};

export type SiteSettings = {
  siteTitle: string;
  siteSubtitle: string;
  siteIconDataUrl: string;
  faviconDataUrl: string;
  siteIconFit: "contain" | "cover";
};

export type LinkItem = {
  id: string;
  groupId: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  order: number;
};

export type CloudNavData = {
  settings?: SiteSettings;
  groups: Group[];
  links: LinkItem[];
};
