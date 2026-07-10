#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <SX127x.h>

SX127x LoRa;

const char* ssid="sree";
const char* password="12345678";
const char* BACKEND_URL = "http://10.68.149.7:5000/api/alert";

const char* DEVICE_ID="PI_NODE_01";
const float LATITUDE=12.97;
const float LONGITUDE=79.16;

String getRisk(String a){
  a.toLowerCase();
  if(a=="elephant"||a=="tiger"||a=="leopard"||a=="bear") return "HIGH";
  if(a=="wild_boar") return "MEDIUM";
  return "LOW";
}

void connectWiFi(){
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid,password);
  while(WiFi.status()!=WL_CONNECTED){delay(500);Serial.print(".");}
  Serial.println();
  Serial.println(WiFi.localIP());
}

void postAlert(String animal)
{
    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("WiFi lost.");

      WiFi.disconnect();
      WiFi.begin(ssid,password);

      unsigned long start=millis();

      while(WiFi.status()!=WL_CONNECTED && millis()-start<10000)
      {
        delay(500);
        Serial.print(".");
      }

      Serial.println();

      if(WiFi.status()!=WL_CONNECTED)
      {
        Serial.println("Reconnect failed");
        return;
      }

      Serial.println("WiFi reconnected");
    }
    Serial.print("Backend: ");
    Serial.println(BACKEND_URL);

    WiFiClient testClient;

    if(!testClient.connect("10.68.149.7",5000))
    {
      Serial.println("Cannot connect to Flask server");
      return;
    }
    else
    {
      Serial.println("Flask server reachable");
      testClient.stop();
    }
    WiFiClient client;
    HTTPClient http;
    http.setTimeout(30000);
    http.begin(client, BACKEND_URL);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"detection\":{";
    json += "\"label\":\"" + animal + "\",";
    json += "\"confidence\":1.0,";
    json += "\"risk\":\"" + getRisk(animal) + "\"";
    json += "},";
    json += "\"location\":{";
    json += "\"lat\":" + String(LATITUDE,6) + ",";
    json += "\"lng\":" + String(LONGITUDE,6);
    json += "}";
    json += "}";

    Serial.println("Sending JSON:");
    Serial.println(json);

    int httpCode = http.POST(json);

    Serial.print("HTTP Code: ");
    Serial.println(httpCode);

    if (httpCode > 0)
    {
        Serial.println(http.getString());
    }
    else
    {
        Serial.print("Error: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
}

void setup(){
  Serial.begin(115200);
  SPI.begin(18,19,23,5);
  connectWiFi();
  if(!LoRa.begin(5,14,26,-1,-1)){Serial.println("LoRa fail");while(true);}
  LoRa.setFrequency(433000000);
  LoRa.setRxGain(SX127X_RX_GAIN_POWER_SAVING,SX127X_RX_GAIN_AUTO);
  LoRa.setSpreadingFactor(7);
  LoRa.setBandwidth(125000);
  LoRa.setCodeRate(5);
  LoRa.setHeaderType(SX127X_HEADER_EXPLICIT);
  LoRa.setPreambleLength(12);
  LoRa.setPayloadLength(64);
  LoRa.setCrcEnable(true);
  LoRa.setSyncWord(0x34);
  Serial.println("Waiting...");
}

void loop(){
  LoRa.request();
  LoRa.wait();
  uint8_t len=LoRa.available();
  if(!len) return;
  if(len>64) len=64;
  char msg[65]={0};
  LoRa.read((uint8_t*)msg,len);
  Serial.println(msg);
  String p(msg);
  if(p.startsWith("ALERT:")){
    String animal=p.substring(6);
    animal.trim();
    postAlert(animal);
  }
}
