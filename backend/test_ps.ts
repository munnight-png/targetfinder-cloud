import { execSync } from 'child_process';
import iconv from 'iconv-lite';

async function testPS() {
    const cmd = `powershell -Command "Get-Content 'fulldata_11_43_02_P_담배소매업.csv' -Encoding Default | Select-String '영업/정상' | Select-String '의정부' | Select-Object -First 2"`;
    const buffer = execSync(cmd);
    const content = iconv.decode(buffer, 'cp949');
    console.log('PS Output Sample:');
    console.log(content);
}
testPS();
