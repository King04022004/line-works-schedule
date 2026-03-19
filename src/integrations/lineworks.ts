import { config } from "../config.js";
import { LineWorksApiClient } from "./lineworks.client.js";
import { mockLineWorksClient } from "./lineworks.mock.js";

export const lineWorksClient = config.useMock ? mockLineWorksClient : new LineWorksApiClient();
