import { Cell, Dictionary } from "@ton/core";
import { TonClient } from "@ton/ton";
import dotenv from 'dotenv';
import { Evaa, getPrices, MAINNET_POOL_CONFIG } from "../src";

let client: TonClient;
beforeAll(async () => {
    dotenv.config();
    client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    });
});


test('getPrices test', async () => {
  const prices = await client.open(new Evaa({poolConfig: MAINNET_POOL_CONFIG})).getPrices(['evaa.space']);
  console.log(prices.dict);
});

test('prices parsing test', async () => {
    const response = await fetch('https://evaa.space/api/core/v2/outputs/0x2c21cabdaa89739de16bde7bc44e86401fac334a3c7e55305fe5e7563043e191');
    
    if (!response.ok) {
      throw new Error(`Error per making request: ${response.status}`);
    }
    
    const result: any = await response.json();
    const features = result.output.features as any[];

    //if (features.length > 0 && features[0].data) {
    const data2 = features[0].data;
    //const data2 = '0x7b22737461747573223a226f6b222c2274696d657374616d70223a313733303730303135382c227061636b6564507269636573223a22623565653963373234313032313230313030303139643030303130393637323836333765633030313032303132303032303930323031323030333036303230313230303430353030346462663734383433336663626363316163373565353437393866623963646664386433363862386436616533303932663463323931636638343635353930663762313461303234333034633130353030303464626636363237633565616637353065313565363839303036613138663133363133306661326236383734613632653537663963353239626334336366616534396365613032356262643435613930303230313230303730383030346462663532616364316432313063383965363036343537333266626431663535356638343365306235346135663133303565303835623538336663313639613133613061303236303066373634643030303462626635376634323439393832363837613239373461666264613533336564656132396562653463656565313333633738366631323435396338313033643937663232383931626265336431303032303132303061306630323031323030623065303230313230306330643030346262663066363435623161313434323030383431333437646436613962333863336163373931646562623738333465303362623838363233383339353936303766313930656536326532613630303034646266333164653933356536326133643430333733656531646538316338396631333261373539653039343133333731663338616234303134373935393037303063393430353431633739306336303030346262663637306632643034366333326632623139343935386162643336623763373163643131386563363335663039393063656163383633653933353066316465363638373731643966326630303230313230313031313030346262663535323030643761376636303761366162623564646666323736343937643231356635346463373934303065376665616534316631353061353932363634663038373731643966326630303034646266343034626364346165626532653962346461633461656638336663343039393935346261336338663861623864363431386366623564636164383661663663306133623565323266636533306235373733343666222c227369676e6174757265223a223365333834373165376438313234653933653033363832636565326264363337616362646139343634313765653632313430373064623034633761383538656464316139633238333536376564633762663333653632336330383339653530643665326139626265333432366365646564363661643135636334343563353066222c22617373657473223a5b223131383736393235333730383634363134343634373939303837363237313537383035303530373435333231333036343034353633313634363733383533333337393239313633313933373338222c223931363231363637393033373633303733353633353730353537363339343333343435373931353036323332363138303032363134383936393831303336363539333032383534373637323234222c223831323033353633303232353932313933383637393033383939323532373131313132383530313830363830313236333331333533383932313732323231333532313437363437323632353135222c223539363336353436313637393637313938343730313334363437303038353538303835343336303034393639303238393537393537343130333138303934323830313130303832383931373138222c223333313731353130383538333230373930323636323437383332343936393734313036393738373030313930343938383030383538333933303839343236343233373632303335343736393434222c223233313033303931373834383631333837333732313030303433383438303738353135323339353432353638373531393339393233393732373939373333373238353236303430373639373637222c22313031333835303433323836353230333030363736303439303637333539333330343338343438333733303639313337383431383731303236353632303937393739303739353430343339393034222c223730373732313936383738353634353634363431353735313739303435353834353935323939313637363735303238323430303338353938333239393832333132313832373433393431313730222c223438383339333132383635333431303530353736353436383737393935313936373631353536353831393735393935383539363936373938363031353939303330383732353736343039343839225d2c227075626c69634b6579223a2239616431313530383735323064393162366234356436613835323165623436313665653639313461663037666162646332653964313832366462623137303738227d';
    const data = JSON.parse(
        decodeURIComponent(data2.replace('0x', '').replace(/[0-9a-f]{2}/g, '%$&')),
    );
    /*{id: 0, address: '0xd3a8c0b9fd44fd25a49289c631e3ac45689281f2f8cf0744400b4c65bed38e5d'}, 
    {id: 1, address: '0x2c21cabdaa89739de16bde7bc44e86401fac334a3c7e55305fe5e7563043e191'},
    {id: 2, address: '0x2eb258ce7b5d02466ab8a178ad8b0ba6ffa7b58ef21de3dc3b6dd359a1e16af0'},
    {id: 3, address: '0xf9a0769954b4430bca95149fb3d876deb7799d8f74852e0ad4ccc5778ce68b52'},*/
    await fetch('https://nlpzx-3qaaa-aaaaj-azvlq-cai.raw.icp0.io/prices/set/0xd3a8c0b9fd44fd25a49289c631e3ac45689281f2f8cf0744400b4c65bed38e5d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        packedPrices: data.packedPrices,
        signature: data.signature
      })
    })
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.error('Error:', error));
    
    const timestamp = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0].beginParse().loadUint(32);
    console.log('ts', timestamp, Date.now() / 1000 - timestamp)
    //console.log(data.packedPrices);

    //console.log(data.signature);
    /*const data = {
        "status": "ok",
        "timestamp": 1722946102,
        "packedPrices": "b5ee9c7241020c0100011400010966b21236c001020120020702012003060201200405004dbf748433fcbcc1ac75e54798fb9cdfd8d368b8d6ae3092f4c291cf8465590f7b14a028b5169450004dbf6627c5eaf750e15e689006a18f136130fa2b6874a62e57f9c529bc43cfae49cea02a23141af0004dbf895668e908644f30322b997de8faaafc21f05aa52f8982f042dac1fe0b4d09d05015345cb0e8020120080b020120090a004bbf47b22d8d0a21004209a3eeb54d9c61d63c8ef5dbc1a701ddc4311c1cacb03f8c877345b810004bbf670f2d046c32f2b194958abd36b7c71cd118ec635f0990ceac863e9350f1de668774113350004bbf8a9006bd3fb03d355daeeff93b24be90afaa6e3ca0073ff5720f8a852c93327843ba0899a86a405464",
        "signature": "cb79689019b8968bd7cea4855bc7f9f9ea06674a3ced955c16878addb7dd49985760908734c2b6119df48d034a0276b4b5affa50cb2a88d6173a7716e6ba8e0b",
        "assets": [
          "11876925370864614464799087627157805050745321306404563164673853337929163193738",
          "91621667903763073563570557639433445791506232618002614896981036659302854767224",
          "81203563022592193867903899252711112850180680126331353892172221352147647262515",
          "59636546167967198470134647008558085436004969028957957410318094280110082891718",
          "33171510858320790266247832496974106978700190498800858393089426423762035476944",
          "23103091784861387372100043848078515239542568751939923972799733728526040769767"
        ],
        "publicKey": "473a72ac2bbfc14da3a77314c2cb73e755b88e7d1d6eae05ea88b4ce176a46c9"
      };*/
    //console.log('hash', Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0].hash().toString('hex'));
    //const timestamp = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0].beginParse().loadUint(32);
    //console.log('ts', timestamp)
    const pricesSlice = Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex'))[0].beginParse();

    //console.log('prices_slice', pricesSlice.remainingRefs);
    //console.log(Cell.fromBoc(Buffer.from(data['packedPrices'], 'hex')));
    //console.log('ref', pricesSlice.loadRef().beginParse());
    
    const dict = pricesSlice.loadRef().beginParse().loadDictDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigVarUint(4));
    const signature = Buffer.from(data['signature'], 'hex');
    //console.log(dict, signature);
});
