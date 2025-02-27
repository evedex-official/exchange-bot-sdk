import dotenv from "dotenv";
dotenv.config({ path: "test/system/.env" });
import { get as envGet } from "env-var";

export default {
  authURI: envGet("AUTH_URI").required().asUrlString(),
  exchangeURI: envGet("EXCHANGE_URI").required().asUrlString(),
  centrifugoURI: envGet("CENTRIFUGO_URI").required().asUrlString(),
  centrifugoPrefix: envGet("CENTRIFUGO_PREFIX").required().asString(),
  ethNode: envGet("ETH_NODE").required().asString(),
  privateKey: envGet("PRIVATE_KEY").required().asString(),
  apiKey: envGet("API_KEY").required().asString(),
  userAuthId: "634b7bfa-273d-48f7-90c5-cc02e4deea74",
  siwe: {
    message: "exchange-api-test",
    address: "0xAB750c44e08053Ac7E711b64860D65F75bAbE36B",
    signature:
      "0x0e11c138b21d74f0cff35af490bf3b7d710ea6ac9e65d9e46fba3614d3cb32487499504580705a857f51b66002178b4fdd967107d5001cc7485e5ed48acb93801c",
  },
};
