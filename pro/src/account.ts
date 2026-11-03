import { nanoid } from "nanoid";
import {
  OAUTH2_FORCE_EXPIRE_MILLISECONDS,
  type RemotelySavePluginSettings,
  type SUPPORTED_SERVICES_TYPE,
} from "../../src/baseTypes";
import {
  COMMAND_CALLBACK_PRO,
  type FeatureInfo,
  PRO_CLIENT_ID,
  type PRO_FEATURE_TYPE,
  PRO_WEBSITE,
  type ProConfig,
} from "./baseTypesPro";
import { codeVerifier2CodeChallenge } from "./oauth2";

const site = PRO_WEBSITE;
console.debug(`remotelysave official website: ${site}`);

// THUNDER: personal build. All PRO features are enabled locally, no
// Remotely Save account or subscription is consulted. The settings UI
// shows or hides each PRO service panel based on enabledProFeatures,
// and checkProRunnableAndFixInplace below gates syncs on the same
// list, so every feature is seeded here exactly once. Expiry is set
// far in the future (2100-01-01) as plain numbers, matching what the
// PRO server returns at runtime. Marked for future upstream merges:
// search this file, src/main.ts, and THUNDER.md for "THUNDER:".
export const THUNDER_ALL_PRO_FEATURES: FeatureInfo[] = [
  "feature-smart_conflict",
  "feature-onedrive_full",
  "feature-google_drive",
  "feature-box",
  "feature-pcloud",
  "feature-yandex_disk",
  "feature-koofr",
  "feature-azure_blob_storage",
].map((featureName) => ({
  featureName: featureName as PRO_FEATURE_TYPE,
  enableAtTimeMs: 0 as unknown as bigint,
  expireAtTimeMs: 4102444800000 as unknown as bigint,
}));

export const DEFAULT_PRO_CONFIG: ProConfig = {
  accessToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  refreshToken: "",
  enabledProFeatures: THUNDER_ALL_PRO_FEATURES,
  email: "",
};

export const generateAuthUrlAndCodeVerifierChallenge = async (
  hasCallback: boolean
) => {
  const appKey = PRO_CLIENT_ID ?? "cli-"; // hard-code
  const codeVerifier = nanoid(128);
  const codeChallenge = await codeVerifier2CodeChallenge(codeVerifier);
  let authUrl = `${site}/oauth2/authorize?response_type=code&client_id=${appKey}&token_access_type=offline&code_challenge_method=S256&code_challenge=${codeChallenge}&scope=pro.list.read`;
  if (hasCallback) {
    authUrl += `&redirect_uri=obsidian://${COMMAND_CALLBACK_PRO}`;
  }
  return {
    authUrl,
    codeVerifier,
    codeChallenge,
  };
};

export const sendAuthReq = async (
  verifier: string,
  authCode: string,
  errorCallBack: any
) => {
  const appKey = PRO_CLIENT_ID ?? "cli-"; // hard-code
  try {
    const k = {
      code: authCode,
      grant_type: "authorization_code",
      code_verifier: verifier,
      client_id: appKey,
      // redirect_uri: `obsidian://${COMMAND_CALLBACK_PRO}`,
      scope: "pro.list.read",
    };
    // console.debug(k);
    const resp1 = await fetch(`${site}/api/v1/oauth2/token`, {
      method: "POST",
      body: new URLSearchParams(k),
    });
    const resp2 = await resp1.json();
    return resp2;
  } catch (e) {
    console.error(e);
    if (errorCallBack !== undefined) {
      await errorCallBack(e);
    }
  }
};

export const sendRefreshTokenReq = async (refreshToken: string) => {
  const appKey = PRO_CLIENT_ID ?? "cli-"; // hard-code
  try {
    console.info("start auto getting refreshed Remotely Save access token.");
    const resp1 = await fetch(`${site}/api/v1/oauth2/token`, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: appKey,
        scope: "pro.list.read",
      }),
    });
    const resp2: AuthResError | AuthResSucc = await resp1.json();
    console.info("finish auto getting refreshed Remotely Save access token.");
    return resp2;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

interface AuthResError {
  error: "invalid_request";
}

interface AuthResSucc {
  error: undefined; // needed for typescript
  refresh_token?: string;
  access_token: string;
  expires_in: number;
}

export const setConfigBySuccessfullAuthInplace = async (
  config: ProConfig,
  authRes: AuthResError | AuthResSucc,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
) => {
  if (authRes.error !== undefined) {
    throw Error(
      `remotely save account auth failed, please auth again: ${authRes.error}`
    );
  }

  config.accessToken = authRes.access_token;
  config.accessTokenExpiresAtTimeMs =
    Date.now() + authRes.expires_in * 1000 - 5 * 60 * 1000;
  config.accessTokenExpiresInMs = authRes.expires_in * 1000;
  config.refreshToken = authRes.refresh_token || config.refreshToken;

  // manually set it expired after 80 days;
  config.credentialsShouldBeDeletedAtTimeMs =
    Date.now() + OAUTH2_FORCE_EXPIRE_MILLISECONDS;

  await saveUpdatedConfigFunc?.();

  console.info(
    "finish updating local info of Remotely Save official website token"
  );
};

export const getAccessToken = async (
  config: ProConfig,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
) => {
  const ts = Date.now();
  if (
    config.accessToken !== undefined &&
    config.accessToken !== "" &&
    config.accessTokenExpiresAtTimeMs > ts &&
    (config.credentialsShouldBeDeletedAtTimeMs ?? ts + 1000 * 1000) > ts
  ) {
    return config.accessToken;
  }

  console.debug(
    `currently, accessToken=${config.accessToken}, accessTokenExpiresAtTimeMs=${
      config.accessTokenExpiresAtTimeMs
    }, credentialsShouldBeDeletedAtTimeMs=${
      config.credentialsShouldBeDeletedAtTimeMs
    },comp1=${config.accessTokenExpiresAtTimeMs > ts}, comp2=${
      (config.credentialsShouldBeDeletedAtTimeMs ?? ts + 1000 * 1000) > ts
    }`
  );

  // try to get it again??
  const res = await sendRefreshTokenReq(config.refreshToken ?? "refresh-");
  await setConfigBySuccessfullAuthInplace(config, res, saveUpdatedConfigFunc);

  if (res.error !== undefined) {
    throw Error("cannot update accessToken");
  }
  return res.access_token;
};

export const getAndSaveProFeatures = async (
  config: ProConfig,
  pluginVersion: string,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
) => {
  const access = await getAccessToken(config, saveUpdatedConfigFunc);

  const resp1 = await fetch(`${site}/api/v1/pro/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access}`,
      "REMOTELYSAVE-API-Plugin-Ver": pluginVersion,
    },
  });
  const rsp2: {
    proFeatures: FeatureInfo[];
  } = await resp1.json();

  config.enabledProFeatures = rsp2.proFeatures;
  await saveUpdatedConfigFunc?.();
  return rsp2;
};

export const getAndSaveProEmail = async (
  config: ProConfig,
  pluginVersion: string,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
) => {
  const access = await getAccessToken(config, saveUpdatedConfigFunc);

  const resp1 = await fetch(`${site}/api/v1/profile/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access}`,
      "REMOTELYSAVE-API-Plugin-Ver": pluginVersion,
    },
  });
  const rsp2: {
    email: string;
  } = await resp1.json();

  config.email = rsp2.email;
  await saveUpdatedConfigFunc?.();
  return rsp2;
};

/**
 * If the check doesn't pass, the function should throw the error
 * @returns
 */
export const checkProRunnableAndFixInplace = async (
  config: RemotelySavePluginSettings,
  pluginVersion: string,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
): Promise<true> => {
  // THUNDER: personal build. The upstream PRO subscription check is
  // neutralized here: no Remotely Save account, token, or server call
  // is required. All PRO features (Smart Conflict and every PRO
  // service) are treated as enabled. Existing installs may carry an
  // old empty enabledProFeatures list in data.json, so it is reset
  // in place to the full local list and saved back.
  console.debug(`checkProRunnableAndFixInplace (Thunder: always enabled)`);
  if (config.pro === undefined) {
    config.pro = { ...DEFAULT_PRO_CONFIG };
  }
  const alreadyEnabled =
    config.pro.enabledProFeatures?.length ===
      THUNDER_ALL_PRO_FEATURES.length &&
    THUNDER_ALL_PRO_FEATURES.every((f) =>
      config.pro!.enabledProFeatures.some(
        (x) => x.featureName === f.featureName
      )
    );
  if (!alreadyEnabled) {
    config.pro.enabledProFeatures = [...THUNDER_ALL_PRO_FEATURES];
    await saveUpdatedConfigFunc?.();
  }
  return true;
};
