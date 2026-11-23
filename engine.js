/*
  Pep/8 Lab — assembler and simulator
  Copyright (C) 2026  최규하 (Choi Gyuha)
  Based on Pep/8, Copyright (C) 2009  J. Stanley Warford, Pepperdine University.
  Modified November 2026: ported from the upstream C++ source to JavaScript.
  Licensed under the GNU GPL, version 3 or (at your option) any later version.
  No warranty; see vendor/PEP8-LICENSE.txt and vendor/NOTICE.txt.
*/
// Browser port of the official Pep/8 assembler and simulator
// (StanWarford/pep8: asm.cpp, code.cpp, sim.cpp, objectcodepane.cpp, assemblerlistingpane.cpp).
// Behaviour, error texts and listing columns follow that source; see vendor/NOTICE.txt.
export const modes=['i','d','n','s','sf','x','sx','sxf'];
export const ops={};
const add=(name,code,unary=false,allowed=modes,trap=false,required=true)=>ops[name]={name,code,unary,allowed,trap,required};
['STOP','RETTR','MOVSPA','MOVFLGA'].forEach((n,i)=>add(n,i,true));
['BR','BRLE','BRLT','BREQ','BRNE','BRGE','BRGT','BRV','BRC','CALL'].forEach((n,i)=>add(n,4+i*2,false,['i','x'],false,false));
['NOT','NEG','ASL','ASR','ROL','ROR'].forEach((n,i)=>['A','X'].forEach((r,j)=>add(n+r,24+i*2+j,true)));
for(let i=0;i<4;i++)add('NOP'+i,36+i,true,modes,true);
[['NOP',40,['i'],true],['DECI',48,modes.slice(1),true],['DECO',56,modes,true],['STRO',64,['d','n','sf'],true],['CHARI',72,modes.slice(1),false],['CHARO',80,modes,false]].forEach(([n,c,a,t])=>add(n,c,false,a,t));
for(let i=0;i<8;i++)add('RET'+i,88+i,true);
add('ADDSP',96);add('SUBSP',104);
['ADD','SUB','AND','OR','CP','LD','LDBYTE','ST','STBYTE'].forEach((n,i)=>['A','X'].forEach((r,j)=>add(n+r,112+i*16+j*8,false,n.startsWith('ST')?modes.slice(1):modes)));
// decode[b] = [op, addressing mode bits, legal for this op]. Every byte decodes, as in Pep::initDecoderTables.
export const decode=Array(256);
for(const o of Object.values(ops)){if(o.unary)decode[o.code]=[o,'',true];else if(o.code<24)['i','x'].forEach((m,k)=>decode[o.code+k]=[o,m,true]);else modes.forEach((m,k)=>decode[o.code+k]=[o,m,o.allowed.includes(m)]);}
// Pep::decodeAddrMode is NONE for unary and trap opcodes, so the CPU pane shows no mode or operand for them.
export const displayMode=b=>{const [o,m]=decode[b];return o.unary||o.trap?'':m;};
export const instrName=b=>{const m=displayMode(b);return ' '+decode[b][0].name+(m?', '+m:'');};
export const signed=n=>(n&65535)>32767?(n&65535)-65536:n&65535;
export const hex=(n,w=4)=>(n>>>0).toString(16).toUpperCase().padStart(w,'0');

// --- Lexical analysis (Asm::getToken) ---
const W='[\\p{L}\\p{N}\\p{M}_]'; // QRegExp \w
const RX={mode:/^((,)(\s*)(i|d|x|n|s(?![fx])|sx(?![f])|sf|sxf){1}){1}/i,
 char:/^((')(?!['])(([^'\\]){1}|((\\)(['|bfnrtv"\\]))|((\\)(([x|X])([0-9|A-F|a-f]{2}))))('))/,
 comment:/^((;{1})(.)*)/,dec:/^((([+|-]{0,1})([0-9]+))|^(([1-9])([0-9]*)))/,
 dot:new RegExp('^((.)(([A-Z|a-z]{1})('+W+')*))','u'),hex:/^((0(?![x|X]))|((0)([x|X])([0-9|A-F|a-f])+)|((0)([0-9]+)))/,
 ident:new RegExp('^((([A-Z|a-z|_]{1})('+W+'*))(:){0,1})','u'),
 str:/^((")((([^"\\])|((\\)(['|bfnrtv"\\]))|((\\)(([x|X])([0-9|A-F|a-f]{2}))))*)("))/};
function token(s){s=s.trim();const take=(t,rx,err)=>{const m=s.match(rx);if(!m)throw Error(err);return {t,v:m[0],rest:s.slice(m[0].length)};};
 if(!s)return {t:'empty',v:'',rest:''};const c=s[0];
 if(c===',')return take('mode',RX.mode,'ERROR: Malformed addressing mode.');
 if(c==="'")return take('char',RX.char,'ERROR: Malformed character constant.');
 if(c===';')return take('comment',RX.comment,'ERROR: Malformed comment');
 if(s.length>=2&&c==='0'&&(s[1]==='x'||s[1]==='X'))return take('hex',RX.hex,'ERROR: Malformed hex constant.');
 if(/\p{Nd}/u.test(c)||c==='+'||c==='-')return take('dec',RX.dec,'ERROR: Malformed decimal constant.');
 if(c==='.')return take('dot',RX.dot,'ERROR: Malformed dot command.');
 if(/\p{L}/u.test(c)||c==='_'){const r=take('ident',RX.ident,'ERROR: Malformed identifier.');if(r.v.endsWith(':'))r.t='symdef';return r;}
 if(c==='"')return take('string',RX.str,'ERROR: Malformed string constant.');
 throw Error('ERROR: Syntax error.');}
// QString::toInt(&ok, base) result as used by the official assembler: 0 when the text does not fit an int.
const toInt=(s,b)=>{if(!(b===16?/^[0-9a-f]+$/i:/^[+-]?[0-9]+$/).test(s))return 0;const v=parseInt(s,b);return v>=-2147483648&&v<=2147483647?v:0;};
const latin1=c=>{if(!c)return 0;const v=c.charCodeAt(0);return v>255?0:v;}; // QChar::toLatin1()
// Asm::unquotedStringToInt: returns [byte, remaining text]
function nextByte(s){if(s.startsWith('\\x')||s.startsWith('\\X'))return [toInt(s.slice(2,4),16)&255,s.slice(4)];
 if(s[0]==='\\'){const e={b:8,f:12,n:10,r:13,t:9,v:11}[s[1]];return [e??latin1(s[1]),s.slice(2)];}
 return [latin1(s[0]),s.slice(1)];}
const unquote=t=>t.slice(1,-1);
export function stringBytes(t){const out=[];let s=unquote(t);while(s.length){const [v,r]=nextByte(s);out.push(v);s=r;}return out;}
const byteLength=t=>stringBytes(t).length;
const string2=t=>{const [a,r]=nextByte(unquote(t));if(!r)return a;return 256*a+nextByte(r)[0];};
const argValue=(a,sym)=>a.kind==='char'?nextByte(unquote(a.text))[0]:a.kind==='string'?string2(a.text):a.kind==='symbol'?(sym.get(a.text)??0):a.value;
const argText=a=>a.kind==='hex'?'0x'+hex(a.value):a.kind==='dec'?String(a.value>=32768?a.value-65536:a.value):a.kind==='udec'?String(a.value):a.text;
const aaa=m=>modes.indexOf(m);

// --- Parser (Asm::processSourceLine) ---
function parseLine(src,st,lineNum){let state='start',code=null,label='',tok,s=src;
 const instr=(name)=>{const o=ops[name.toUpperCase()];if(!o)throw Error('ERROR: Invalid mnemonic.');code={type:o.unary?'unary':'nonunary',op:o,name:o.name,label,addr:st.pc};st.pc+=o.unary?1:3;state=o.unary?'close':'instr';};
 const dot=(name)=>{const d=name.slice(1).toUpperCase();if(!['ADDRSS','ASCII','BLOCK','BURN','BYTE','END','EQUATE','WORD'].includes(d))throw Error('ERROR: Invalid dot command.');code={type:d.toLowerCase(),name:'.'+d,label,addr:st.pc};if(d==='END')st.end=true;state='dot'+d;};
 const range=(v,lo,hi,msg)=>{if(v<lo||v>hi)throw Error(msg);return v;};
 const decArg=(v)=>v<0?{kind:'dec',value:v+65536}:{kind:'udec',value:v};
 const symRef=(t)=>{if(t.length>8)throw Error('ERROR: Symbol '+t+' cannot have more than eight characters.');st.refs.push([t,lineNum]);return {kind:'symbol',text:t};};
 do{tok=token(s);s=tok.rest;const {t,v}=tok;
  switch(state){
  case 'start':
   if(t==='ident')instr(v);else if(t==='dot')dot(v);
   else if(t==='symdef'){const n=v.slice(0,-1);if(n.length>8)throw Error('ERROR: Symbol '+n+' cannot have more than eight characters.');if(st.sym.has(n))throw Error('ERROR: Symbol '+n+' was previously defined.');label=n;st.sym.set(n,st.pc);st.adjust.set(n,true);state='symdef';}
   else if(t==='comment'){code={type:'comment',comment:v,addr:st.pc};state='comment';}
   else if(t==='empty'){code={type:'blank',addr:st.pc};state='finish';}
   else throw Error('ERROR: Line must start with symbol definition, mnemonic, dot command, or comment.');
   break;
  case 'symdef':if(t==='ident')instr(v);else if(t==='dot')dot(v);else throw Error('ERROR: Must have mnemonic or dot command after symbol definition.');break;
  case 'instr':
   if(t==='ident')code.arg=symRef(v);
   else if(t==='string'){if(byteLength(v)>2)throw Error('ERROR: String operands must have length at most two.');code.arg={kind:'string',text:v};}
   else if(t==='hex')code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,65535,'ERROR: Hexidecimal constant is out of range (0x0000..0xFFFF).')};
   else if(t==='dec')code.arg=decArg(range(toInt(v,10),-32768,65535,'ERROR: Decimal constant is out of range (-32768..65535).'));
   else if(t==='char')code.arg={kind:'char',text:v};
   else throw Error('ERROR: Operand specifier expected after mnemonic.');
   state='mode';break;
  case 'mode':
   if(t==='mode'){const m=v.slice(1).trim().toLowerCase();if(!code.op.allowed.includes(m))throw Error('ERROR: Illegal addressing mode for this instruction.');code.mode=m;state='close';}
   else if(code.op.required)throw Error('ERROR: Addressing mode required for this instruction.');
   else{code.mode='i';if(t==='comment'){code.comment=v;state='comment';}else if(t==='empty')state='finish';else throw Error('ERROR: Comment expected following instruction.');}
   break;
  case 'dotADDRSS':if(t!=='ident')throw Error('ERROR: .ADDRSS requires a symbol argument.');code.arg=symRef(v);st.pc+=2;state='close';break;
  case 'dotASCII':if(t!=='string')throw Error('ERROR: .ASCII requires a string constant argument.');code.arg={kind:'string',text:v};st.pc+=byteLength(v);state='close';break;
  case 'dotBLOCK':
   if(t==='dec')code.arg=decArg(range(toInt(v,10),0,65535,'ERROR: Decimal constant is out of range (0..65535).'));
   else if(t==='hex')code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,65535,'ERROR: Hexidecimal constant is out of range (0x0000..0xFFFF).')};
   else throw Error('ERROR: .BLOCK requires a decimal or hex constant argument.');
   st.pc+=code.arg.value;state='close';break;
  case 'dotBURN':if(t!=='hex')throw Error('ERROR: .BURN requires a hex constant argument.');code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,65535,'ERROR: Hexidecimal constant is out of range (0x0000..0xFFFF).')};st.burnCount++;st.burn=code.arg.value;st.romStart=st.pc;state='close';break;
  case 'dotBYTE':
   if(t==='char')code.arg={kind:'char',text:v};
   else if(t==='dec'){const n=range(toInt(v,10),-128,255,'ERROR: Decimal constant is out of byte range (-128..255).');code.arg={kind:'dec',value:n<0?n+256:n};}
   else if(t==='hex')code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,255,'ERROR: Hex constant is out of byte range (0x00..0xFF).')};
   else if(t==='string'){if(byteLength(v)>1)throw Error('ERROR: .BYTE string operands must have length one.');code.arg={kind:'string',text:v};}
   else throw Error('ERROR: .BYTE requires a char, dec, hex, or string constant argument.');
   st.pc+=1;state='close';break;
  case 'dotEND':if(t==='comment'){code.comment=v;state='finish';}else if(t==='empty')state='finish';else throw Error('ERROR: Only a comment can follow .END.');break;
  case 'dotEQUATE':
   if(!code.label)throw Error('ERROR: .EQUATE must have a symbol definition.');
   if(t==='dec')code.arg=decArg(range(toInt(v,10),-32768,65535,'ERROR: Decimal constant is out of range (-32768..65535).'));
   else if(t==='hex')code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,65535,'ERROR: Hexidecimal constant is out of range (0x0000..0xFFFF).')};
   else if(t==='string'){if(byteLength(v)>2)throw Error('ERROR: .EQUATE string operand must have length at most two.');code.arg={kind:'string',text:v};}
   else throw Error('ERROR: .EQUATE requires a dec, hex, or string constant argument.');
   st.sym.set(code.label,argValue(code.arg));st.adjust.set(code.label,false);state='close';break;
  case 'dotWORD':
   if(t==='char')code.arg={kind:'char',text:v};
   else if(t==='dec')code.arg=decArg(range(toInt(v,10),-32768,65535,'ERROR: Decimal constant is out of range (-32768..65535).'));
   else if(t==='hex')code.arg={kind:'hex',value:range(toInt(v.slice(2),16),0,65535,'ERROR: Hexidecimal constant is out of range (0x0000..0xFFFF).')};
   else if(t==='string'){if(byteLength(v)>2)throw Error('ERROR: .WORD string operands must have length at most two.');code.arg={kind:'string',text:v};}
   else throw Error('ERROR: .WORD requires a char, dec, hex, or string constant argument.');
   st.pc+=2;state='close';break;
  case 'close':if(t==='empty')state='finish';else if(t==='comment'){code.comment=v;state='comment';}else throw Error('ERROR: Comment expected following instruction.');break;
  case 'comment':if(t==='empty')state='finish';else throw Error('ERROR: Problem detected after comment.');break;
  }
 }while(state!=='finish');
 code.label=code.label||'';code.comment=code.comment||'';code.line=lineNum+1;code.raw=src;return code;}

// --- Code generation (Code::appendObjectCode) and listing (Code::appendSourceLine) ---
function objectOf(c,sym){switch(c.type){
 case 'unary':return [c.op.code];
 case 'nonunary':{const v=argValue(c.arg,sym)&65535;return [c.op.code+(c.op.required?aaa(c.mode):c.mode==='x'?1:0),v>>8,v&255];}
 case 'addrss':{const v=(sym.get(c.arg.text)??0)&65535;return [v>>8,v&255];}
 case 'ascii':return stringBytes(c.arg.text);
 case 'block':return new Array(c.arg.value).fill(0);
 case 'byte':return [argValue(c.arg,sym)&255];
 case 'word':{const v=argValue(c.arg,sym)&65535;return [v>>8,v&255];}
 default:return [];}}
function listLines(c,sym,p){const L=[],addr=hex(c.addr),labelStr=(c.label?c.label+':':'').padEnd(9),inRom=!(p.burnCount===1&&c.addr<p.romStart),push=(text,check=false)=>L.push({text,addr:check?c.addr:null,check});
 const groups=bytes=>{const g=[];for(let i=0;i<bytes.length;i+=3)g.push(bytes.slice(i,i+3).map(b=>hex(b,2)).join(''));return g;};
 const multi=(name,bytes)=>{const g=groups(bytes);push(addr.padEnd(6)+(inRom?(g[0]??''):'      ').padEnd(7)+labelStr+name.padEnd(8)+argText(c.arg).padEnd(12)+c.comment);if(inRom)g.slice(1).forEach(x=>push('      '+x.padEnd(7)));};
 switch(c.type){
 case 'unary':push(addr.padEnd(6)+(inRom?hex(c.op.code,2):'  ').padEnd(7)+labelStr+c.name.padEnd(8)+'            '+c.comment,true);break;
 case 'nonunary':{const b=objectOf(c,sym),code=inRom?hex(b[0],2):'  ',num=inRom?hex(argValue(c.arg,sym)&65535):'    ',mode=c.op.required||c.mode==='x'?','+c.mode:'';push(addr.padEnd(6)+code.padEnd(2)+num.padEnd(5)+labelStr+c.name.padEnd(8)+(argText(c.arg)+mode).padEnd(12)+c.comment,true);break;}
 case 'addrss':push(addr.padEnd(6)+(inRom?hex((sym.get(c.arg.text)??0)&65535):'    ').padEnd(7)+labelStr+'.ADDRSS'.padEnd(8)+argText(c.arg).padEnd(12)+c.comment);break;
 case 'ascii':multi('.ASCII',stringBytes(c.arg.text));break;
 case 'block':multi('.BLOCK',new Array(c.arg.value).fill(0));break;
 case 'burn':push(addr.padEnd(6)+'       '+labelStr+'.BURN'.padEnd(8)+argText(c.arg).padEnd(12)+c.comment);break;
 case 'byte':{let o=argText(c.arg);if(o.startsWith('0x'))o=o.slice(0,2)+o.slice(4);push(addr.padEnd(6)+(inRom?hex(argValue(c.arg,sym)&255,2):'  ').padEnd(7)+labelStr+'.BYTE'.padEnd(8)+o.padEnd(12)+c.comment);break;}
 case 'end':push(addr.padEnd(6)+'       '+labelStr+'.END'.padEnd(8)+'              '+c.comment);break;
 case 'equate':push('             '+labelStr+'.EQUATE'.padEnd(8)+argText(c.arg).padEnd(12)+c.comment);break;
 case 'word':push(addr.padEnd(6)+(inRom?hex(argValue(c.arg,sym)&65535):'    ').padEnd(7)+labelStr+'.WORD'.padEnd(8)+argText(c.arg).padEnd(12)+c.comment);break;
 case 'comment':push('             '+c.comment);break;
 case 'blank':push('');break;}
 return L;}
const RULE='-------------------------------------------------------------------------------',RULE2='--------------------------------------';
function listingText(lines,sym){let out=[RULE,'      Object','Addr  code   Symbol   Mnemon  Operand     Comment',RULE,...lines.map(l=>l.text),RULE];
 if(sym.size){out.push('','','Symbol table',RULE2,'Symbol    Value        Symbol    Value',RULE2);const keys=[...sym.keys()].sort();let row='';
  for(const k of keys){const h=hex(sym.get(k)&65535);if(!row)row=k.padEnd(10)+h.padEnd(13);else{out.push(row+k.padEnd(10)+h.padEnd(4));row='';}}
  if(row)out.push(row);out.push(RULE2);}
 return out.join('\n');}

// SourceCodePane::assemble plus the .BURN relocation done when installing an OS.
export function assemble(source){const st={pc:0,sym:new Map(),adjust:new Map(),refs:[],burnCount:0,burn:null,romStart:0,end:false},codes=[],src=source.split('\n');
 for(let i=0;i<src.length&&!st.end;i++){try{codes.push(parseLine(src[i],st,i));}catch(e){throw Error((i+1)+'행 · '+e.message);}}
 if(!st.end)throw Error('1행 · ERROR: Missing .END sentinel.');
 if(st.pc>65535)throw Error('1행 · ERROR: Object code size too large to fit into memory.');
 for(const [t,ln] of st.refs)if(!st.sym.has(t))throw Error((ln+1)+'행 · ERROR: Symbol '+t+' is used but not defined.');
 let romStart=st.romStart;
 if(st.burnCount===1){const delta=st.burn-st.pc+1;for(const [k,v] of st.sym)if(st.adjust.get(k))st.sym.set(k,v+delta);codes.forEach(c=>c.addr+=delta);romStart+=delta;}
 const p={symbols:Object.fromEntries(st.sym),symbolTypes:Object.fromEntries([...st.adjust].map(([k,a])=>[k,a?'address':'constant'])),size:st.pc,burn:st.burn,burnCount:st.burnCount,romStart:st.burnCount===1?romStart:65536,codes};
 const objectBytes=[],lines=[];
 for(const c of codes){const b=objectOf(c,st.sym);c.size=b.length;c.object=b;if(st.burnCount===0||c.addr>=p.romStart)objectBytes.push(...b);lines.push(...listLines(c,st.sym,p));}
 p.objectBytes=objectBytes;p.lines=lines;p.listingText=listingText(lines,st.sym);
 // Edit > Format From Listing: drop the 13-column address/code prefix and the empty rows.
 p.formatted=lines.map(l=>l.text.length>=13?l.text.slice(13):l.text).filter(s=>s!=='').join('\n');
 p.records=codes.filter(c=>c.type==='unary'||c.type==='nonunary');
 return p;}

export function objectText(bytes){return Array.from(bytes).map((v,i)=>hex(v,2)+(i%16===15?'\n':' ')).join('')+'zz';}
// ObjectCodePane::getObjectCode: fixed "two hex chars + one separator" cells, ends at a lower-case z.
export function parseObject(text){const out=[];let s=text;const fail=()=>Error('Load failed · 두 자리 16진수와 구분 문자 하나씩, 끝은 소문자 zz여야 해요.');
 while(s.length>0){if(s[1]==='z')return Uint8Array.from(out);if(s.length<3)throw fail();const t=s.slice(0,2).trim();s=s.slice(3);if(!/^[0-9a-f]+$/i.test(t))throw fail();out.push(parseInt(t,16));}
 throw fail();}
export function listing(program){return program.listingText;}
export function disassemble(mem,pc){const b=mem[pc&65535],[op,mode,valid]=decode[b],v=mem[(pc+1)&65535]*256+mem[(pc+2)&65535];return {addr:pc,name:op.name,mode,size:op.unary?1:3,text:op.name+(op.unary?'':` 0x${hex(v)}, ${mode}`),valid};}

// --- CPU (Sim::vonNeumannStep) ---
const add16=(a,b)=>(a+b)&65535;
export class Machine {
  constructor(os){this.os=os;this.mem=new Uint8Array(65536);this.mem.set(os.objectBytes.slice(0,65536-os.romStart),os.romStart);this.A=this.X=this.SP=this.PC=this.IR=this.OS=this.operand=0;this.operandWidth=4;this.N=this.Z=this.V=this.C=false;this.input='';this.pos=0;this.output='';this.steps=0;this.halted=false;this.waiting=false;this.active=false;this.loader=false;this.terminal=false;this.trapDepth=0;this.last=null;this.changed=new Set();this.history=[];}
  vector(offset){return this.word(this.os.burn-offset);}
  clearCpu(){this.A=this.X=this.SP=this.PC=0;this.N=this.Z=this.V=this.C=false;}
  // Execute clears the CPU first; Start Debugging keeps A, X, NZVC, IR and operands; the loader starts at the OS vectors.
  begin({kind='run',input='',terminal=false}={}){if(kind==='run')this.clearCpu();
    if(kind==='loader'){this.SP=this.vector(5);this.PC=this.vector(3);}else{this.SP=this.vector(7);this.PC=0;}
    this.input=input;this.pos=0;if(kind!=='loader')this.output='';this.terminal=terminal;this.loader=kind==='loader';this.steps=0;this.halted=false;this.waiting=false;this.active=true;this.trapDepth=0;this.last=null;this.changed=new Set();this.history=[];}
  load(bytes){const b=bytes.subarray(0,65536);this.mem.set(b,0);this.changed=new Set(Array.from(b,(_,i)=>i));}
  word(a){return this.mem[a&65535]*256+this.mem[(a+1)&65535];}
  writeByte(a,v){if(a<this.os.romStart){a&=65535;this.mem[a]=v&255;this.changed.add(a);}}
  writeWord(a,v){if(a<this.os.romStart){const b=(a+1)&65535;a&=65535;this.mem[a]=(v>>8)&255;this.mem[b]=v&255;this.changed.add(a);this.changed.add(b);}} // may touch the first ROM byte, as in sim.cpp
  write(a,v){this.writeWord(a,v);}
  flags(){return +this.N*8+ +this.Z*4+ +this.V*2+ +this.C;}
  addr(mode,v){const SP=this.SP,X=this.X;return mode==='d'?v:mode==='n'?this.word(v):mode==='s'?add16(SP,v):mode==='sf'?this.word(add16(SP,v)):mode==='x'?add16(v,X):mode==='sx'?add16(add16(SP,v),X):mode==='sxf'?add16(this.word(add16(SP,v)),X):0;}
  readWordOprnd(m,v){return m==='i'?v:this.word(this.addr(m,v));}
  readByteOprnd(m,v){return m==='i'?v:this.mem[this.addr(m,v)];}
  addNZVC(l,r){let res=l+r;this.C=res>=65536;res&=65535;this.N=res>=32768;this.Z=res===0;this.V=(l<32768&&r<32768&&res>=32768)||(l>=32768&&r>=32768&&res<32768);return res;}
  nz(v){this.N=v>=32768;this.Z=v===0;}
  snapshot(){return {A:this.A,X:this.X,SP:this.SP,PC:this.PC,N:this.N,Z:this.Z,V:this.V,C:this.C,IR:this.IR,OS:this.OS,operand:this.operand};}
  step(){if(this.halted)return false;const start=this.PC,[op,mode,valid]=decode[this.mem[start]],n=op.name;
    if(n==='CHARI'&&this.terminal&&this.pos>=this.input.length){this.waiting=true;return false;}
    this.waiting=false;const before=this.snapshot();
    this.IR=this.mem[start];this.PC=add16(start,1);if(!op.unary){this.OS=this.word(this.PC);this.PC=add16(this.PC,2);}this.steps++;
    if(!op.unary&&!op.trap&&!valid)throw Error('Invalid Addressing Mode.');
    const v=this.OS,neg=x=>(~x+1)&65535,reg=n.endsWith('SP')?'SP':n.endsWith('X')?'X':'A',W=()=>{this.operandWidth=4;return this.operand=this.readWordOprnd(mode,v);},B=()=>{this.operandWidth=2;return this.operand=this.readByteOprnd(mode,v);};
    if(op.trap){const t=this.vector(5);this.writeByte(t-1,this.IR);this.writeWord(t-3,this.SP);this.writeWord(t-5,this.PC);this.writeWord(t-7,this.X);this.writeWord(t-9,this.A);this.writeByte(t-10,this.flags());this.SP=(t-10)&65535;this.PC=this.vector(1);this.trapDepth++;}
    else if(n==='STOP'){this.halted=true;this.active=false;}
    else if(n==='RETTR'){const sp=this.SP,f=this.mem[sp];this.N=!!(f&8);this.Z=!!(f&4);this.V=!!(f&2);this.C=!!(f&1);this.A=this.word(sp+1);this.X=this.word(sp+3);this.PC=this.word(sp+5);this.SP=this.word(sp+7);this.trapDepth=Math.max(0,this.trapDepth-1);}
    else if(n==='MOVSPA')this.A=this.SP;
    else if(n==='MOVFLGA')this.A=this.flags();
    else if(/^ADD(A|X|SP)$/.test(n))this[reg]=this.addNZVC(this[reg],W());
    else if(/^SUB(A|X|SP)$/.test(n))this[reg]=this.addNZVC(this[reg],neg(W()));
    else if(/^CP[AX]$/.test(n)){this.addNZVC(this[reg],neg(W()));if(this.V)this.N=!this.N;}
    else if(/^(AND|OR)[AX]$/.test(n)){const o=W();this[reg]=n.startsWith('AND')?this[reg]&o:this[reg]|o;this.N=this[reg]>32768;this.Z=this[reg]===0;} // strict > as in sim.cpp
    else if(/^ASL/.test(n)){const r=this[reg];this.V=(r>=0x4000&&r<0x8000)||(r>=0x8000&&r<0xC000);let x=r*2;this.C=x>=65536;x&=65535;this[reg]=x;this.nz(x);}
    else if(/^ASR/.test(n)){const r=this[reg];this.C=r%2===1;this[reg]=r<32768?r>>1:(r>>1)+32768;this.nz(this[reg]);}
    else if(/^ROL/.test(n)){const r=this[reg],b=r>=32768;this[reg]=((r*2)&65535)|(this.C?1:0);this.C=b;}
    else if(/^ROR/.test(n)){const r=this[reg],b=r%2===1;this[reg]=(r>>1)|(this.C?0x8000:0);this.C=b;}
    else if(/^NEG/.test(n)){this[reg]=neg(this[reg]);this.nz(this[reg]);this.V=this[reg]===32768;}
    else if(/^NOT/.test(n)){this[reg]=~this[reg]&65535;this.nz(this[reg]);}
    else if(n==='CALL'){const d=W();this.SP=add16(this.SP,65534);this.writeWord(this.SP,this.PC);this.PC=d;}
    else if(n.startsWith('BR')){const d=W();const yes={BR:true,BRLE:this.N||this.Z,BRLT:this.N,BREQ:this.Z,BRNE:!this.Z,BRGE:!this.N,BRGT:!this.N&&!this.Z,BRV:this.V,BRC:this.C}[n];if(yes)this.PC=d;}
    else if(/^RET\d$/.test(n)){this.SP=add16(this.SP,Number(n[3]));this.PC=this.word(this.SP);this.SP=add16(this.SP,2);}
    else if(/^LD[AX]$/.test(n)){this[reg]=W()&65535;this.nz(this[reg]);}
    else if(/^LDBYTE/.test(n)){this[reg]=(this[reg]&0xff00)|(B()&255);this.nz(this[reg]);}
    else if(/^ST[AX]$/.test(n)){this.writeWord(this.addr(mode,v),this[reg]);W();}
    else if(/^STBYTE/.test(n)){this.writeByte(this.addr(mode,v),this[reg]&255);B();}
    else if(n==='CHARI'){const c=this.pos<this.input.length?latin1(this.input[this.pos++]):0;this.writeByte(this.addr(mode,v),c);B();} // batch EOF reads 0
    else if(n==='CHARO'){const c=B();if(this.output.length>=200000){this.halted=true;this.active=false;throw Error('출력 200,000자 제한에 도달했어요. 실행을 멈췄어요.');}this.output+=String.fromCharCode(c);}
    this.last={addr:start,text:n+(op.unary?'':` 0x${hex(v)}, ${mode}`),before,after:this.snapshot(),step:this.steps};
    this.history.push(this.last);if(this.history.length>2000)this.history.splice(0,1000);
    return true;
  }
}
