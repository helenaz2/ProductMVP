import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useInventory } from "../components/inventory/InventoryStore";

export default function ScanInfo() {
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const { addScan } = useInventory();

  
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  // Open camera
  const pickImage = async () => {
    // Request permission first
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Scanned Item:</Text>
        <Text style={styles.codeText}>{code}</Text>
      </View>

      <Text style={styles.inputLabel}>Position</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. Shelf A-1" 
        value={position}
        onChangeText={setPosition}
      />

      <Text style={styles.inputLabel}>Description</Text>
      <TextInput 
        style={[styles.input, styles.textArea]} 
        placeholder="Add details about this object..." 
        multiline
        value={description}
        onChangeText={setDescription}
      />

      {/* Picture Section */}
      <Text style={styles.inputLabel}>Object Photo</Text>
      <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <Text style={styles.photoText}>+ Tap to take a photo</Text>
        )}
      </TouchableOpacity>
    
      <TouchableOpacity style={styles.saveButton} onPress={() => {
            addScan({
              sku: String(code ?? "").trim(),
              scannedBy: "Display Name", // dummy data
              position,
              description,
              imageUri: image,
            });
        router.replace("/individualWorkspace")}}
      >
        <Text style={styles.saveText}>Save to Inventory</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { marginBottom: 30, marginTop: 40 },
  label: { fontSize: 12, color: '#888', fontWeight: 'bold' },
  codeText: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  inputLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#FAFAFA' },
  textArea: { height: 100, textAlignVertical: 'top' },
  photoBox: { 
    height: 200, borderStyle: 'dashed', borderWidth: 2, 
    borderColor: '#DDD', borderRadius: 12, justifyContent: 'center', 
    alignItems: 'center', marginBottom: 30, overflow: 'hidden' 
  },
  photoText: { color: '#999' },
  previewImage: { width: '100%', height: '100%' }, 
  saveButton: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});