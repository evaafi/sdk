import { Address, Cell } from "@ton/core";
import { PoolAssetConfig } from "../types/Master";
import { sha256Hash } from "../utils/sha256BigInt";
import { JETTON_WALLET_STANDART_CODE, JETTON_WALLET_STANDART_CODE_TESTNET } from "./general";

export const TON_MAINNET: PoolAssetConfig = { 
    name: 'TON',
    assetId: sha256Hash('TON'),
    jettonMasterAddress: Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'),  // fake
    jettonWalletCode: Cell.EMPTY 
}
export const TON_TESTNET = TON_MAINNET;

export const JUSDT_MAINNET: PoolAssetConfig = { 
    name: 'jUSDT',
    assetId: sha256Hash('jUSDT'), 
    jettonMasterAddress: Address.parse('EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA'),
    jettonWalletCode: JETTON_WALLET_STANDART_CODE
}

export const JUSDC_MAINNET: PoolAssetConfig = { 
    name: 'jUSDC',
    assetId: sha256Hash('jUSDC'), 
    jettonMasterAddress: Address.parse('EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3728'),
    jettonWalletCode: JETTON_WALLET_STANDART_CODE
}

export const STTON_MAINNET: PoolAssetConfig = { 
    name: 'stTON',
    assetId: sha256Hash('stTON'), 
    jettonMasterAddress: Address.parse('EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k'),
    jettonWalletCode: Cell.fromBase64(
        'te6cckECEgEAA2IAART/APSkE/S88sgLAQIBYgIDAgLMBAUAG6D2BdqJofQB9IH0gahhAgHUBgcCASAJCgHPCDHAJJfBOAB0NMDAXGwlRNfA/AN4PpA+kAx+gAxcdch+gAx+gAwc6m0AALTHyGCEA+KfqW6lTE0WfAK4CGCEBeNRRm6ljFERAPwC+AhghBZXwe8upUxNFnwDOAUXwTABOMCMIQP8vCAIABE+kQwwADy4U2AAfO1E0PoA+kD6QNQwECNfAwGCCJiWgKFtgBByIm6zIJFxkXDiA8jLBVAGzxZQBPoCy2oDk1jMAZEw4gHJAfsAAgFYCwwCAUgQEQHxAPTP/oA+kAh8AHtRND6APpA+kDUMFE2oVIqxwXy4sEowv/y4sJUNEJwVCATVBQDyFAE+gJYzxYBzxbMySLIywES9AD0AMsAySD5AHB0yMsCygfL/8nQBPpA9AQx+gAg10nCAPLixHeAGMjLBVAIzxZw+gIXy2sTzIA0C9ztRND6APpA+kDUMAjTP/oAUVGgBfpA+kBTW8cFVHNtcFQgE1QUA8hQBPoCWM8WAc8WzMkiyMsBEvQA9ADLAMn5AHB0yMsCygfL/8nQUA3HBRyx8uLDCvoAUaihggiYloBmtgihggjk4cCgGKEnlxBJEDg3XwTjDSXXCwGAODwCeghAXjUUZyMsfGcs/UAf6AiLPFlAGzxYl+gJQA88WyVAFzCORcpFx4lAIqBOgggpiWgCgFLzy4sUEyYBA+wAQI8hQBPoCWM8WAc8WzMntVABwUnmgGKGCEHNi0JzIyx9SMMs/WPoCUAfPFlAHzxbJcYAQyMsFJM8WUAb6AhXLahTMyXH7ABAkECMAfMMAI8IAsI4hghDVMnbbcIAQyMsFUAjPFlAE+gIWy2oSyx8Syz/JcvsAkzVsIeIDyFAE+gJYzxYBzxbMye1UAMkMO1E0PoA+kD6QNQwBtM/+gAwUUShUjfHBfLiwSXC//LiwgSCC5OHAL7y4sWCEHvdl97Iyx8Uyz9Y+gIhzxbJcYAYyMsFJM8WcPoCy2rMyYBA+wBAE8hQBPoCWM8WAc8WzMntVIACBIAg1yHtRND6APpA+kDUMATTHyGCEBeNRRm6AoIQe92X3roSsfLgyNM/MfoAMBOgUCPIUAT6AljPFgHPFszJ7VSBpMmqD'
    )
}

export const TSTON_MAINNET: PoolAssetConfig = { 
    name: 'tsTON',
    assetId: sha256Hash('tsTON'), 
    jettonMasterAddress: Address.parse('EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav'),
    jettonWalletCode: Cell.fromBase64(
        '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'
    )
}

export const USDT_MAINNET: PoolAssetConfig = { 
    name: 'USDT',
    assetId: sha256Hash('USDT'), 
    jettonMasterAddress: Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'),
    jettonWalletCode: Cell.fromBoc(
        Buffer.from(
          'b5ee9c7241020f010003d1000114ff00f4a413f4bcf2c80b01020162050202012004030021bc508f6a2686981fd007d207d2068af81c0027bfd8176a2686981fd007d207d206899fc152098402f8d001d0d3030171b08e48135f038020d721ed44d0d303fa00fa40fa40d104d31f01840f218210178d4519ba0282107bdd97deba12b1f2f48040d721fa003012a0401303c8cb0358fa0201cf1601cf16c9ed54e0fa40fa4031fa0031f401fa0031fa00013170f83a02d31f012082100f8a7ea5ba8e85303459db3ce0330c0602d0228210178d4519ba8e84325adb3ce034218210595f07bcba8e843101db3ce032208210eed236d3ba8e2f30018040d721d303d1ed44d0d303fa00fa40fa40d1335142c705f2e04a403303c8cb0358fa0201cf1601cf16c9ed54e06c218210d372158cbadc840ff2f0080701f2ed44d0d303fa00fa40fa40d106d33f0101fa00fa40f401d15141a15288c705f2e04926c2fff2afc882107bdd97de01cb1f5801cb3f01fa0221cf1658cf16c9c8801801cb0526cf1670fa02017158cb6accc903f839206e943081169fde718102f270f8380170f836a0811a7770f836a0bcf2b0028050fb00030903f4ed44d0d303fa00fa40fa40d12372b0c002f26d07d33f0101fa005141a004fa40fa4053bac705f82a5464e070546004131503c8cb0358fa0201cf1601cf16c921c8cb0113f40012f400cb00c9f9007074c8cb02ca07cbffc9d0500cc7051bb1f2e04a09fa0021925f04e30d26d70b01c000b393306c33e30d55020b0a09002003c8cb0358fa0201cf1601cf16c9ed54007a5054a1f82fa07381040982100966018070f837b60972fb02c8801001cb055005cf1670fa027001cb6a8210d53276db01cb1f5801cb3fc9810082fb00590060c882107362d09c01cb1f2501cb3f5004fa0258cf1658cf16c9c8801001cb0524cf1658fa02017158cb6accc98011fb0001f203d33f0101fa00fa4021fa4430c000f2e14ded44d0d303fa00fa40fa40d15309c7052471b0c00021b1f2ad522bc705500ab1f2e0495115a120c2fff2aff82a54259070546004131503c8cb0358fa0201cf1601cf16c921c8cb0113f40012f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f401fa00200d019820d70b009ad74bc00101c001b0f2b19130e2c88210178d451901cb1f500a01cb3f5008fa0223cf1601cf1626fa025007cf16c9c8801801cb055004cf1670fa024063775003cb6bccccc945370e00b42191729171e2f839206e938124279120e2216e94318128739101e25023a813a0738103a370f83ca00270f83612a00170f836a07381040982100966018070f837a0bcf2b0048050fb005803c8cb0358fa0201cf1601cf16c9ed5401f9319e',
          'hex'
        )
    )[0],
}

export const JUSDT_TESTNET: PoolAssetConfig = { 
    name: 'jUSDT',
    assetId: sha256Hash('jUSDT'), 
    jettonMasterAddress: Address.parse('kQBe4gtSQMxM5RpMYLr4ydNY72F8JkY-icZXG1NJcsju8XM7'),
    jettonWalletCode: JETTON_WALLET_STANDART_CODE_TESTNET
}

export const JUSDC_TESTNET: PoolAssetConfig = { 
    name: 'jUSDC',
    assetId: sha256Hash('jUSDC'), 
    jettonMasterAddress: Address.parse('kQDaY5yUatYnHei73HBqRX_Ox9LK2XnR7XuCY9MFC2INbfYI'),
    jettonWalletCode: JETTON_WALLET_STANDART_CODE_TESTNET
}

export const STTON_TESTNET: PoolAssetConfig = { 
    name: 'stTON',
    assetId: sha256Hash('stTON'), 
    jettonMasterAddress: Address.parse('kQC3Duw3dg8k98xf5S7Bm7YOWVJ5QW8hm3iLqFfJfa_g9h07'),
    jettonWalletCode: Cell.fromBoc(
        Buffer.from(
            'b5ee9c7201021201000362000114ff00f4a413f4bcf2c80b0102016202030202cc0405001ba0f605da89a1f401f481f481a8610201d40607020120090a01cf0831c02497c138007434c0c05c6c2544d7c0fc03383e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7c8608403e29fa96ea54c4d167c027808608405e351466ea58c511100fc02b80860841657c1ef2ea54c4d167c02f80517c1300138c08c2103fcbc200800113e910c30003cb85360007ced44d0fa00fa40fa40d43010235f03018208989680a16d801072226eb32091719170e203c8cb055006cf165004fa02cb6a039358cc019130e201c901fb000201200b0c0081d40106b90f6a2687d007d207d206a1802698f90c1080bc6a28cdd0141083deecbef5d0958f97064699f98fd001809d02811e428027d012c678b00e78b6664f6aa401f1503d33ffa00fa4021f001ed44d0fa00fa40fa40d4305136a1522ac705f2e2c128c2fff2e2c254344270542013541403c85004fa0258cf1601cf16ccc922c8cb0112f400f400cb00c920f9007074c8cb02ca07cbffc9d004fa40f40431fa0020d749c200f2e2c4778018c8cb055008cf1670fa0217cb6b13cc80d0201200e0f009e8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a0820a625a00a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5402f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a019ad8228608239387028062849e5c412440e0dd7c138c34975c2c060101100c90c3b51343e803e903e90350c01b4cffe800c145128548df1c17cb8b04970bffcb8b0812082e4e1c02fbcb8b160841ef765f7b232c7c532cfd63e808873c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b552000705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023007cc30023c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed54',
            'hex',
        ),
    )[0],
}

export const TONUSDT_DEDUST_MAINNET: PoolAssetConfig = {
    name: 'TONUSDT_DEDUST',
    assetId: sha256Hash('TONUSDT_DEDUST'), 
    jettonMasterAddress: Address.parse('EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r'),
    jettonWalletCode: Cell.fromBoc(
        Buffer.from(
            'b5ee9c7241021201000334000114ff00f4a413f4bcf2c80b0102016202110202cc03060201d4040500c30831c02497c138007434c0c05c6c2544d7c0fc02f83e903e900c7e800c5c75c87e800c7e800c1cea6d0000b4c7e08403e29fa954882ea54c4d167c0238208405e3514654882ea58c511100fc02780d60841657c1ef2ea4d67c02b817c12103fcbc2000113e910c1c2ebcb85360020148070e020120080a01f100f4cffe803e90087c007b51343e803e903e90350c144da8548ab1c17cb8b04a30bffcb8b0950d109c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c032483e401c1d3232c0b281f2fff274013e903d010c7e800835d270803cb8b11de0063232c1540233c59c3e8085f2dac4f3200900ae8210178d4519c8cb1f19cb3f5007fa0222cf165006cf1625fa025003cf16c95005cc2391729171e25008a813a08208e4e1c0aa008208989680a0a014bcf2e2c504c98040fb001023c85004fa0258cf1601cf16ccc9ed5403f73b51343e803e903e90350c0234cffe80145468017e903e9014d6f1c1551cdb5c150804d50500f214013e809633c58073c5b33248b232c044bd003d0032c0327e401c1d3232c0b281f2fff274140371c1472c7cb8b0c2be80146a2860822625a020822625a004ad8228608239387028062849f8c3c975c2c070c008e00b0c0d00705279a018a182107362d09cc8cb1f5230cb3f58fa025007cf165007cf16c9718010c8cb0524cf165006fa0215cb6a14ccc971fb0010241023000e10491038375f040076c200b08e218210d53276db708010c8cb055008cf165004fa0216cb6a12cb1f12cb3fc972fb0093356c21e203c85004fa0258cf1601cf16ccc9ed540201200f1000db3b51343e803e903e90350c01f4cffe803e900c145468549271c17cb8b049f0bffcb8b0a0823938702a8005a805af3cb8b0e0841ef765f7b232c7c572cfd400fe8088b3c58073c5b25c60063232c14933c59c3e80b2dab33260103ec01004f214013e809633c58073c5b3327b55200083200835c87b51343e803e903e90350c0134c7e08405e3514654882ea0841ef765f784ee84ac7cb8b174cfcc7e800c04e81408f214013e809633c58073c5b3327b5520001ba0f605da89a1f401f481f481a861f0a7d84b',
            'hex',
        ),
    )[0],
}

export const TON_STORM_MAINNET: PoolAssetConfig = { 
    name: 'TON_STORM',
    assetId: sha256Hash('TON_STORM'), 
    jettonMasterAddress: Address.parse('EQCNY2AQ3ZDYwJAqx_nzl9i9Xhd_Ex7izKJM6JTxXRnO6n1F'),
    jettonWalletCode: Cell.fromBoc(
        Buffer.from(
            'b5ee9c7241021301000380000114ff00f4a413f4bcf2c80b0102016202100202cd030f04add106380792000e8698180b8d8474289af81ed9e707d207d2018fd0018b8eb90fd0018fd001839d4da0001698f90c10807c53f52dd4742989a2ced9e7010c1080bc6a28cdd474318a22201ed9e701a9041082caf83de5d40405080c00888020d721ed44d0fa00fa40fa40d74c04d31f8200fff0228210178d4519ba0382107bdd97deba13b112f2f4d33f31fa003013a05023c85004fa0258cf1601cf16ccc9ed5401f603d33ffa00fa4021f007ed44d0fa00fa40fa40d74c5136a1522ac705f2e2c128c2fff2e2c2545255705202541304c85004fa0258cf1601cf16ccc921c8cb0113f40012f400cb00c97021f90074c8cb0212cb07cbffc9d004fa40f40431fa0020d749c200f2e2c48210178d4519c8cb1f1acb3f5008fa0223cf1601060176cf1626fa025007cf162591729171e2500aa815a0820a43d580a016bcf2e2c57007c9103741408040db3c4300c85004fa0258cf1601cf16ccc9ed5407002e778018c8cb055005cf165005fa0213cb6bccccc901fb0002f6ed44d0fa00fa40fa40d74c08d33ffa005151a005fa40fa40547c25705202541304c85004fa0258cf1601cf16ccc921c8cb0113f40012f400cb00c97021f90074c8cb0212cb07cbffc9d031536cc7050dc7051cb1f2e2c30afa0051a8a12195104a395f04e30d048208989680b60972fb0225d70b01c30003c20013090a014c521aa018a182107362d09cc8cb1f5240cb3f5003fa0201cf165008cf16c954253071db3c10350e0158b08e948210d53276dbc8cb1f14cb3f704055810082db3c923333e25003c85004fa0258cf1601cf16ccc9ed540b0030708018c8cb055004cf165004fa0212cb6a01cf17c901fb0002a08e843059db3ce06c22ed44d0fa00fa40fa40d74c10235f030182106d8e5e3cba8ea75202c705f2e2c1820898968070fb0201d70b3f8210d53276dbc8cb1fcb3f7001c912810082db3ce05f03840ff2f00d0e01bc30ed44d0fa00fa40fa40d74c06d33ffa00fa40305151a15248c705f2e2c126c2fff2e2c20582100ee6b280b9f2d2c782107bdd97dec8cb1fcb3f5004fa0221cf1658cf167001c952308040db3c4013c85004fa0258cf1601cf16ccc9ed540e002c718018c8cb055004cf165004fa0212cb6accc901fb000011f7d22186000797163402016611120021b5fe7da89a1f401f481f481ae9826be070001bb7605da89a1f401f481f481ae990c6f31b9d',
            'hex',
        ),
    )[0],
}

export const USDT_STORM_MAINNET: PoolAssetConfig = { 
    name: 'USDT_STORM',
    assetId: sha256Hash('USDT_STORM'), 
    jettonMasterAddress: Address.parse('EQCup4xxCulCcNwmOocM9HtDYPU8xe0449tQLp6a-5BLEegW'),
    jettonWalletCode: Cell.fromBoc(
        Buffer.from(
            'b5ee9c7241021301000380000114ff00f4a413f4bcf2c80b0102016202100202cd030f04add106380792000e8698180b8d8474289af81ed9e707d207d2018fd0018b8eb90fd0018fd001839d4da0001698f90c10807c53f52dd4742989a2ced9e7010c1080bc6a28cdd474318a22201ed9e701a9041082caf83de5d40405080c00888020d721ed44d0fa00fa40fa40d74c04d31f8200fff0228210178d4519ba0382107bdd97deba13b112f2f4d33f31fa003013a05023c85004fa0258cf1601cf16ccc9ed5401f603d33ffa00fa4021f007ed44d0fa00fa40fa40d74c5136a1522ac705f2e2c128c2fff2e2c2545255705202541304c85004fa0258cf1601cf16ccc921c8cb0113f40012f400cb00c97021f90074c8cb0212cb07cbffc9d004fa40f40431fa0020d749c200f2e2c48210178d4519c8cb1f1acb3f5008fa0223cf1601060176cf1626fa025007cf162591729171e2500aa815a0820a43d580a016bcf2e2c57007c9103741408040db3c4300c85004fa0258cf1601cf16ccc9ed5407002e778018c8cb055005cf165005fa0213cb6bccccc901fb0002f6ed44d0fa00fa40fa40d74c08d33ffa005151a005fa40fa40547c25705202541304c85004fa0258cf1601cf16ccc921c8cb0113f40012f400cb00c97021f90074c8cb0212cb07cbffc9d031536cc7050dc7051cb1f2e2c30afa0051a8a12195104a395f04e30d048208989680b60972fb0225d70b01c30003c20013090a014c521aa018a182107362d09cc8cb1f5240cb3f5003fa0201cf165008cf16c954253071db3c10350e0158b08e948210d53276dbc8cb1f14cb3f704055810082db3c923333e25003c85004fa0258cf1601cf16ccc9ed540b0030708018c8cb055004cf165004fa0212cb6a01cf17c901fb0002a08e843059db3ce06c22ed44d0fa00fa40fa40d74c10235f030182106d8e5e3cba8ea75202c705f2e2c1820898968070fb0201d70b3f8210d53276dbc8cb1fcb3f7001c912810082db3ce05f03840ff2f00d0e01bc30ed44d0fa00fa40fa40d74c06d33ffa00fa40305151a15248c705f2e2c126c2fff2e2c20582100ee6b280b9f2d2c782107bdd97dec8cb1fcb3f5004fa0221cf1658cf167001c952308040db3c4013c85004fa0258cf1601cf16ccc9ed540e002c718018c8cb055004cf165004fa0212cb6accc901fb000011f7d22186000797163402016611120021b5fe7da89a1f401f481f481ae9826be070001bb7605da89a1f401f481f481ae990c6f31b9d',
            'hex',
        ),
    )[0],
}
