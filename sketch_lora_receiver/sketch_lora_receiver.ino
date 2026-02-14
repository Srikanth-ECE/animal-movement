#include <HardwareSerial.h>

HardwareSerial lora(2); // UART2

String hexToString(String hex) {
  String result = "";
  for (int i = 0; i < hex.length(); i += 2) {
    String byteStr = hex.substring(i, i + 2);
    char c = (char) strtol(byteStr.c_str(), NULL, 16);
    result += c;
  }
  return result;
}

void setup() {
  Serial.begin(115200);
  lora.begin(9600, SERIAL_8N1, 16, 17); // RX, TX

  delay(2000);

  lora.println("AT");
  delay(500);

  lora.println("AT+MODE=TEST");
  delay(500);

  lora.println("AT+TEST=RFCFG,865000000,SF7,125,8,15,ON,OFF");
  delay(500);

  lora.println("AT+TEST=RXLRPKT");
  Serial.println("📡 Listening...");
}

void loop() {
  if (lora.available()) {
    String msg = lora.readString();
    Serial.println(msg);

    if (msg.indexOf("+TEST: RX") >= 0) {

      int q1 = msg.indexOf("\"");
      int q2 = msg.lastIndexOf("\"");

      if (q1 > 0 && q2 > q1) {
        String hex = msg.substring(q1 + 1, q2);
        String json = hexToString(hex);

        Serial.println("✅ RECEIVED JSON:");
        Serial.println(json);
      }

      // listen again
      lora.println("AT+TEST=RXLRPKT");
    }
  }
}
