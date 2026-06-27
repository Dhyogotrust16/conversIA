type DomSelectorEntry =
  | { model: string; selector: string[] }
  | { model: string; selector: string }
  | { model: string; parm: string }
  | { model: string; list: Record<string, string | number> };

type DomSelectorPayload = {
  version: string;
  update_path: string;
  update_path_new: string;
  update_path_active: string;
  disabled_wait_sync: boolean;
  wpp_mensagens: {
    timer: string;
    enable_two_send: boolean;
  };
  [key: string]: DomSelectorEntry | string | boolean | { timer: string; enable_two_send: boolean };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const localDomSelectorBase: DomSelectorPayload = {
  version: "1.8.1-local",
  update_path: "http://127.0.0.1:8787/api/urls/update",
  update_path_new: "http://127.0.0.1:8787/api/services/update",
  update_path_active: "true",
  disabled_wait_sync: false,
  wpp_mensagens: {
    timer: "60000",
    enable_two_send: false
  },
  newModel: { model: "taghtml", parm: "body.color-refresh" },
  app: { model: "querySelector", selector: ["#app"] },
  afiliadoMain: { model: "querySelector", selector: ["body > div"] },
  paneSide: { model: "Element", selector: "#pane-side" },
  waPage: { model: "querySelector", selector: ["#app > div > div ._aigs"] },
  two: { model: "Element", selector: "two" },
  menuLateral: { model: "querySelector", selector: [".two._aigs > div:nth-child(6)"] },
  closeChat: { model: "Element", selector: "x10l6tqk" },
  chatListInput: { model: "querySelector", selector: [".lexical-rich-text-input > div"] },
  searchInput: { model: "querySelector", selector: ["[data-icon='search']"] },
  downAba: {
    model: "querySelector",
    selector: ["header > div > div > div > div > span > div > div:nth-child(1)", "header > div._ak0w"]
  },
  chatListHeader: { model: "querySelector", selector: ["header > header > div > span > div"] },
  searchCamp: { model: "querySelector", selector: ["#side > div._ak9t > div"] },
  chatName: {
    model: "querySelector",
    selector: [
      "#main > header > div.x78zum5 > div > div > div > div",
      "#main > header > div > div:first-child > div:first-child",
      "#main header > div > div:first-child > div:first-child",
      "#main header span[dir='auto'][title]",
      "#main header [title]"
    ]
  },
  menuVertical: {
    model: "querySelector",
    selector: ["#main ._amm9", "#main .x1n2onr6.x1vjfegm.x1cqoux5.x14yy4lh"]
  },
  menuHorizontal: { model: "querySelector", selector: ["#main > header > div.x1c4vz4f > div"] },
  menuFooter: { model: "querySelector", selector: ["footer ._ak1m"] },
  respostaRapida: { model: "querySelector", selector: ["footer > div"] },
  footerTextArea: { model: "querySelector", selector: ["footer div[contenteditable=true]"] },
  mainAudio: {
    model: "querySelector",
    selector: ["footer > div.copyable-area > div", "#main > footer", "#main footer"]
  },
  assChat: { model: "querySelector", selector: ["#main > div.x1n2onr6.x1vjfegm.x1cqoux5.x14yy4lh"] },
  assInput: {
    model: "querySelector",
    selector: ["._1VZX7 ._3Uu1_, ._ak1r > div", "#main footer div[contenteditable=true]", "#main footer [role='textbox']"]
  },
  assBtn: {
    model: "querySelector",
    selector: [
      "#main > footer > div > div > span > div > div._ak1r > div > div.x9f619.x78zum5.x6s0dn4",
      "#main > footer > div.copyable-area > div > span > div > div._ak1r > div.x123j3cw",
      "#main footer button[aria-label*='Enviar']",
      "#main footer button[aria-label*='Send']",
      "#main footer button[aria-label*='Gravar']",
      "#main footer button[aria-label*='Record']",
      "#main footer span[data-icon='send']",
      "#main footer span[data-icon='ptt']"
    ]
  },
  assEmoji: {
    model: "querySelector",
    selector: ["#main > footer > div.copyable-area > div > span > div > div._ak1m > div > button[tabindex='-1']"]
  },
  assCitacao: {
    model: "querySelector",
    selector: [
      "#main > footer > div:nth-child(3) > div > div:nth-child(4) > div > div > div > button",
      "#main > footer > div:nth-child(3) > div > div > span > div > div > div.x9f619 > button"
    ]
  },
  listMensages: { model: "querySelector", selector: ["div[data-scrolltracepolicy='wa.web.conversation.messages']"] },
  allMensages: { model: "querySelectorAll", selector: ["#main div > div[data-id]"] },
  assistenteChat: { model: "querySelector", selector: ["#main > footer"] },
  trasferidos: { model: "querySelector", selector: ["#side div[tabindex='-1']"] },
  notification: { model: "querySelector", selector: ["#side > div:nth-child(2)"] },
  quotedMsg: {
    model: "querySelector",
    selector: [
      "#main > footer > div:nth-child(3) > div > div:nth-child(4) > div > div > div",
      "#main > footer > div:nth-child(3) > div > div > span > div > div"
    ]
  },
  listChats: { model: "querySelector", selector: ["#pane-side > div > div > div"] },
  listChatsUsers: {
    model: "querySelectorAll",
    selector: ["#pane-side > div > div > div > div  div[aria-selected]", "#pane-side > div > div > div div[role='button'] > div"]
  },
  listChatAtendimento: { model: "Element", selector: "div._ak8l > div._ak8j > div._ak8i" },
  insertAtendente: { model: "Element", selector: "x10l6tqk xh8yej3 x1g42fcv" },
  reactFiberContainer: {
    model: "listElement",
    list: {
      reactFiber: "__reactFiber",
      reactFiberIndex: 0,
      path_user_id: ".child.memoizedProps[1].props.id._serialized",
      path_key_message: ".memoizedProps.children[0].key"
    }
  },
  updateChatList: { model: "querySelector", selector: ["#side div._ai04 > button"] },
  useTradutor: {
    model: "listElement",
    list: {
      main_audio_1: "div._amk6._amlo",
      main_audio_2: "div._ak49._ak48",
      camp_text_1: "row-translate",
      camp_text_2: "div > span",
      add_btn_tradutor: "div.x1c4vz4f.x1q0g3np.x6s0dn4._amj_",
      camp_audio_1: "div[role=\"slider\"] > canvas",
      camp_audio_2: "div[role=\"slider\"] div._ahwf"
    }
  },
  chatList: { model: "querySelector", selector: ["div.two._aigs > div._aigw"] },
  observerFooter: { model: "querySelector", selector: ["#main > span:nth-child(8)", "#main > :last-child"] },
  observerFooterNewModel: { model: "querySelector", selector: ["#main > footer", "#main footer", "#main"] },
  whatsModal: { model: "querySelector", selector: ["#app > div > div > span:nth-child(4)", "#app > div > div > span:nth-child(3)"] },
  menu_whats: {
    model: "querySelector",
    selector: ["#app > div > div.x78zum5.xdt5ytf.x5yr21d > div > header > div > div:nth-child(2) > div", "header > div > div:nth-child(2) > div"]
  },
  actionMonitor: { model: "querySelector", selector: ["#main header"] },
  footerIconsLeft: {
    model: "querySelector",
    selector: [
      "#main > footer > div > div > span > div > div._ak1r > div",
      "#main footer div.copyable-area > div > span > div",
      "#main footer > div > div > span > div",
      "#main > footer",
      "#main footer"
    ]
  },
  side: { model: "querySelector", selector: ["#side"] },
  chatFiltersContainer: { model: "listElement", list: { div_filters: "_akap _akan _arj9" } },
  chatFilters: { model: "querySelectorAll", selector: ["#side > div:nth-of-type(2) div[role=tab]", "#side > div:nth-of-type(2) button"] },
  selector_theme: { model: "querySelector", selector: [".os-win"] }
};

export function mergeDomSelector(remote: unknown): DomSelectorPayload {
  if (!isRecord(remote)) {
    return localDomSelectorBase;
  }

  return {
    ...localDomSelectorBase,
    ...remote,
    version: localDomSelectorBase.version,
    update_path: localDomSelectorBase.update_path,
    update_path_new: localDomSelectorBase.update_path_new,
    update_path_active: localDomSelectorBase.update_path_active,
    disabled_wait_sync: localDomSelectorBase.disabled_wait_sync,
    chatName: localDomSelectorBase.chatName,
    mainAudio: localDomSelectorBase.mainAudio,
    assInput: localDomSelectorBase.assInput,
    assBtn: localDomSelectorBase.assBtn,
    observerFooterNewModel: localDomSelectorBase.observerFooterNewModel,
    footerIconsLeft: localDomSelectorBase.footerIconsLeft
  } as DomSelectorPayload;
}
