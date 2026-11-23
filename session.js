/*
  Pep/8 Lab — run and debug control
  Copyright (C) 2026  최규하 (Choi Gyuha)
  Based on Pep/8, Copyright (C) 2009  J. Stanley Warford, Pepperdine University.
  Modified November 2026: ported from the upstream C++ source to JavaScript.
  Licensed under the GNU GPL, version 3 or (at your option) any later version.
  No warranty; see vendor/PEP8-LICENSE.txt and vendor/NOTICE.txt.
*/
import {assemble,Machine,parseObject,objectText,decode} from './engine.js';
// Run/debug control ported from the official MainWindow and CpuPane (StanWarford/pep8).
// Web-only limits: Run/Resume pause every 1,000,000 instructions and a trap Single Step pauses after 1,000,000; both continue on the next click.
const LIMIT=1000000;
export class Lab {
  constructor(osSource){this.setOS(osSource);this.program=null;this.object='';this.listing='';this.compiledSource=null;}
  setOS(source){const os=assemble(source);
    if(os.burnCount===0)throw Error('ERROR: .BURN required to install OS.');
    if(os.burnCount>1)throw Error('ERROR: Program contain more than one .BURN.');
    if(os.romStart<0)throw Error('.BURN 주소가 너무 작아 OS가 메모리에 들어가지 않아요.');
    this.os=os;this.osSource=source;this.machine=new Machine(os);this.loaded=false;this.loadedObject=null;this.loadedSource=false;this.kind='object';this.state='ready';
    this.traceTraps=this.traceTraps??false;this.trapped=false;this.debugging=false;this.runBudget=0;this.ioMode='batch';(this.breakpoints??=new Set()).clear();return os;}
  // System > Assemble & install OS: the OS object code and listing take over the panes, as in the desktop app.
  installOS(source){const os=this.setOS(source);this.program=os;this.compiledSource=source;this.object=objectText(os.objectBytes);this.listing=os.listingText;return os;}
  restoreOS(source){this.setOS(source);}
  assemble(source){let p;
    try{p=assemble(source);if(p.burnCount>0)throw Error('1행 · ERROR: .BURN not allowed in program unless installing OS.');}
    catch(e){this.program=null;this.object='';this.listing='';this.compiledSource=null;throw e;} // a failed assembly clears the listing and object panes
    this.program=p;this.compiledSource=source;this.object=objectText(p.objectBytes);this.listing=p.listingText;this.loadedSource=this.loaded&&this.loadedObject===this.object;this.state='assembled';return this.object;}
  load(text){const b=parseObject(text);this.machine.load(b);this.loaded=true;this.loadedObject=objectText(b);this.loadedSource=!!this.program&&this.loadedObject===this.object;this.state='loaded';return b;}
  start(kind,input,mode){const batch=kind==='loader'||mode==='batch';
    const text=kind==='loader'?input:batch?(input.endsWith('\n')?input:input+'\n'):''; // batch input always ends with a newline, even when empty
    this.machine.begin({kind,input:text,terminal:!batch});this.ioMode=batch?'batch':'terminal';this.trapped=kind==='loader';this.runBudget=0;}
  execute(input,mode){this.kind=this.loadedSource?'source':'object';this.traceTraps=false;this.debugging=false;this.start('run',input,mode);this.state='running';}
  runSource(source,input,mode){this.assemble(source);this.load(this.object);this.execute(input,mode);}
  runObject(object,input,mode){this.load(object);this.execute(input,mode);}
  debugSource(object,input,mode){if(!this.program)throw Error('No assembler listing, cannot debug source · 먼저 Assemble 하세요.');this.load(object);this.kind='source';this.debugging=true;this.start('debug',input,mode);this.state='paused';}
  debugObject(object,input,mode){this.load(object);this.kind='object';this.debugging=true;this.start('debug',input,mode);this.state='paused';}
  // The loader reads the raw Object Code text as batch input; RAM is not cleared and Trace Traps is turned on.
  debugLoader(object){this.kind='loader';this.traceTraps=true;this.debugging=true;this.start('loader',object,'batch');this.state='paused';}
  stop(){this.state='stopped';this.machine.active=false;}
  interrupt(){if(this.state==='running'){this.state='paused';this.debugging=true;}}
  resume(){if(!this.machine.active||this.machine.halted)throw Error('실행할 디버깅 세션이 없어요. Run Source 또는 Start Debugging을 선택하세요.');this.state='running';this.runBudget=0;}
  lookahead(){const b=this.machine.mem[this.machine.PC];if(decode[b][0].trap)this.trapped=true;else if(b===1)this.trapped=false;} // CpuPane::trapLookahead
  breakpointAt(pc){return this.breakpoints.has(pc)&&(pc<this.os.romStart||this.traceTraps);} // OS rows only count while tracing traps
  exec(){try{return this.machine.step();}catch(e){this.state='error';this.machine.active=false;throw e;}} // errors end the session
  finish(){this.state='finished';if(this.kind==='loader'){this.loaded=true;this.loadedObject=null;this.loadedSource=false;}}
  tick(budget=1500){if(this.state!=='running')return;const m=this.machine;m.changed.clear();
    for(let i=0;i<budget;i++){if(this.debugging)this.lookahead();this.exec();
      if(m.waiting){this.state='waiting';return;}if(m.halted){this.finish();return;}
      if(this.debugging&&this.breakpointAt(m.PC)){this.state='breakpoint';return;} // Run ignores breakpoints; Resume checks after each step
      if(++this.runBudget>=LIMIT){this.state='limit';return;}}}
  single(){const m=this.machine;if(!m.active||m.halted)throw Error('먼저 Start Debugging을 선택하세요.');m.changed.clear();this.lookahead();
    if(this.trapped&&!this.traceTraps){let n=0;
      do{this.lookahead();this.exec();if(m.waiting){this.state='waiting';return;}if(m.halted){this.finish();return;}if(++n>=LIMIT){this.state='limit';return;}}while(this.trapped);
      this.state='paused';return;}
    this.exec();if(m.waiting){this.state='waiting';return;}if(m.halted){this.finish();return;}this.state='paused';}
  sendInput(text){this.machine.input+=text;this.machine.waiting=false;if(this.state==='waiting')this.state='paused';}
  clearMemory(){const m=this.machine;m.mem.fill(0,0,this.os.romStart);m.clearCpu();m.active=false;this.state='ready';}
  traceRecords(){const m=this.machine;if(this.kind==='loader'||m.PC>=this.os.romStart)return this.os.lines;if(this.kind==='source')return this.program?.lines??[];return [];}
}
