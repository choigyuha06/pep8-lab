export const examples={sum:{input:'12 8',code:`; Read two integers and print their sum.
; Input (Batch I/O INPUT panel): 12 8

         BR      main

num1:    .BLOCK  2
num2:    .BLOCK  2
sum:     .BLOCK  2

main:    DECI    num1, d
         DECI    num2, d
         LDA     num1, d
         ADDA    num2, d
         STA     sum, d
         DECO    sum, d
         STOP
         .END`},hello:{input:'',code:`; Terminate the string with a zero byte.
         BR      main
message: .ASCII  "Hello, Pep/8!\\n\\x00"
main:    STRO    message, d
         STOP
         .END`},positive:{input:'3 -2 7 -5 0',code:`; Add positive integers until 0 is entered.
         BR      main
num:     .BLOCK  2
sum:     .BLOCK  2
main:    LDA     0, i
         STA     sum, d
loop:    DECI    num, d
         LDA     num, d
         BREQ    finish
         BRLT    loop
         ADDA    sum, d
         STA     sum, d
         BR      loop
finish:  DECO    sum, d
         STOP
         .END`},absolute:{input:'-3 4 -5 0',code:`; Sum the absolute values of the input integers (0 to stop).
         BR      main
num:     .BLOCK  2
sum:     .BLOCK  2
main:    LDA     0, i
         STA     sum, d
loop:    DECI    num, d
         LDA     num, d
         BREQ    finish
         BRGE    add
         NEGA
add:     ADDA    sum, d
         STA     sum, d
         BR      loop
finish:  DECO    sum, d
         STOP
         .END`},max:{input:'-9 -3 -7 0',code:`; Initialize the maximum with the first input value.
; Print 0 if the first input value is 0.
         BR      main
num:     .BLOCK  2
max:     .BLOCK  2
main:    DECI    num, d
         LDA     num, d
         STA     max, d
         BREQ    finish
loop:    DECI    num, d
         LDA     num, d
         BREQ    finish
         CPA     max, d
         BRLE    loop
         LDA     num, d
         STA     max, d
         BR      loop
finish:  DECO    max, d
         STOP
         .END`},multiply:{input:'-7 6',code:`; Multiply two integers using repeated addition.
; The result wraps around within 16 bits.
         BR      main
a:       .BLOCK  2
b:       .BLOCK  2
result:  .BLOCK  2
main:    DECI    a, d
         DECI    b, d
         LDA     0, i
         STA     result, d
loop:    LDA     b, d
         BREQ    finish
         BRLT    negative
         SUBA    1, i
         STA     b, d
         LDA     result, d
         ADDA    a, d
         BR      save
negative:LDA     b, d
         ADDA    1, i
         STA     b, d
         LDA     result, d
         SUBA    a, d
save:    STA     result, d
         BR      loop
finish:  DECO    result, d
         STOP
         .END`}};
