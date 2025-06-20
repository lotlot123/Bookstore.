import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';

// Tapos, ito po yung SQLite na gamit namin para magkaroon ng local na database sa phone
import * as SQLite from 'expo-sqlite';

// Gumamit din po ako ng navigation para makalipat-lipat ng screen sa app
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Dito po ako gumawa ng navigation stack — ito yung para mag-navigate between pages
const Stack = createNativeStackNavigator();
let db = null; // Nilagay ko lang muna to para may reference sa database

// Dito po yung mga books na nilagay ko
const books = [
  {
    id: 1,
    title: 'El Filibusterismo',
    author: 'José Protasio Rizal',
    date: 'September 18, 1891',
    price: 89,
    image: require('./assets/elfili.jpg'), // Ginamit ko po is local image
  },
  {
    id: 2,
    title: 'Noli Me Tangere',
    author: 'José Protasio Rizal',
    date: ' March 21, 1887',
    price: 98,
    image: require('./assets/noli.jpg'),
  },
  {
    id: 3,
    title: 'Florante at Laura',
    author: 'Francisco Balagtas',
    date: '1838',
    price: 143,
    image: require('./assets/flor.jpg'),
  },
  {
    id: 4,
    title: 'Ibong Adarna',
    author: 'Jose Dela Cruz',
    date: '1865',
    price: 149,
    image: require('./assets/ibon.jpg'),
  },
];

// Dito po ako gumawa ng function para i-setup yung database table na para sa cart.
const setupDatabase = async () => {
  db = await SQLite.openDatabaseAsync('cart.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY UATOINCREMENT,
      title TEXT,
      quantity INTEGER DEFAULT 1
    );
  `);
};

// Ito na po 'yung unang screen na makikita — list ng mga libro
function BookListScreen({ navigation }) {
  const [cartCount, setCartCount] = useState(0); //  Eto po is para makita kung ilang books na nasa cart

  // Ginamit ko po ang useEffect para i-setup agad ang database kapag unang bukas
  useEffect(() => {
    setupDatabase().then(fetchCartCount);
  }, []);

  // Dito po nadadagdagan ang cart kapag nag-click ng "Add to Cart"
  const addToCart = async (title) => {
    if (!db) return;
    const existingItems = await db.getAllAsync('SELECT * FROM cart WHERE title = ?;', [title]);
    if (existingItems.length > 0) {
      const item = existingItems[0];
      const newQuantity = item.quantity + 1;
      await db.runAsync('UPDATE cart SET quantity = ? WHERE id = ?;', [newQuantity, item.id]);
    } else {
      await db.runAsync('INSERT INTO cart (title, quantity) VALUES (?, 1);', [title]);
    }
    await fetchCartCount(); // I-update ang bilang ng nasa cart
  };

  // Dito ko kinukuha kung ilan ang laman ng cart
  const fetchCartCount = async () => {
    if (!db) return;
    const results = await db.getAllAsync('SELECT SUM(quantity) as totalQuantity FROM cart;');
    const total = results[0].totalQuantity ?? 0;
    setCartCount(total);
  };

  // Ito po yung design sa bawat book item
  const renderBook = ({ item }) => (
    <View style={styles.card}>
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.image} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.details}>by {item.author}</Text>
      <Text style={styles.details}>{item.date}</Text>
      <Text style={styles.price}>₱{item.price}</Text>
      <TouchableOpacity onPress={() => addToCart(item.title)} style={styles.button}>
        <Text style={styles.buttonText}>Add to Cart</Text>
      </TouchableOpacity>
    </View>
  );

  // Ito po yung pinaka-layout ng Book List page
  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f7' }}>
      <View style={styles.header}>
        <Text style={styles.headerText}>WessBooks</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartIcon}>🛒 {cartCount}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={books}
        renderItem={renderBook}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.container}
      />
    </View>
  );
}

// Ito na po yung Cart screen kung saan makikita yung mga napili na
function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);

  // Gusto ko po na every time bumalik sa screen, fresh ang data
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCartItems();
    });
    return unsubscribe;
  }, [navigation]);

  // Eto po is taga kuha ng lahat ng items sa cart
  const fetchCartItems = async () => {
    if (!db) return;
    const results = await db.getAllAsync('SELECT * FROM cart;');
    setCartItems(results);
  };

  // Para po sa pagtanggal ng isang item
  const deleteCartItem = async (id) => {
    await db.runAsync('DELETE FROM cart WHERE id = ?;', [id]);
    await fetchCartItems();
  };

  // Pwede rin po dagdagan or bawasan ang quantity dito
  const updateQuantity = async (id, newQuantity) => {
    if (newQuantity <= 0) {
      await deleteCartItem(id);
    } else {
      await db.runAsync('UPDATE cart SET quantity = ? WHERE id = ?;', [newQuantity, id]);
    }
    await fetchCartItems();
  };

  // Kapag nag-checkout, Matatangal na po yung cart
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    await db.runAsync('DELETE FROM cart;');
    setCartItems([]);
    alert('Thank you for your purchase!');
    navigation.goBack();
  };

  // Dito ko po pinapakita lahat ng nasa cart
  return (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>🛒 Cart Items</Text>
      <ScrollView>
        {cartItems.length === 0 ? (
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        ) : (
          cartItems.map((item) => (
            <View key={item.id} style={styles.cartRow}>
              <Text style={styles.cartItem}>
                • {item.title} (x{item.quantity})
              </Text>
              <View style={styles.cartActions}>
                <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={[styles.qtyButton, { backgroundColor: '#e74c3c' }]}>
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={[styles.qtyButton, { backgroundColor: '#3498db' }]}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCartItem(item.id)} style={[styles.deleteButton, { marginLeft: 10 }]}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity onPress={handleCheckout} style={styles.checkoutButton}>
        <Text style={styles.checkoutButtonText}>Checkout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Ito po ang pinaka-root ng app, dito ko nilagay yung dalawang screen
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Books">
        <Stack.Screen name="Books" component={BookListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Cart" component={CartScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
// Ito naman po is para sa mga designs and positions
const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    width: 170,
    margin: 10,
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  image: {
    width: 100,
    height: 140,
    resizeMode: 'cover',
    marginBottom: 10,
    borderRadius: 8,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  details: {
    fontSize: 11,
    textAlign: 'center',
    color: '#555',
    marginBottom: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2d3436',
    marginVertical: 6,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
  },
  header: {
    paddingTop: 35,
    paddingBottom: 15,
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  cartIcon: {
    fontSize: 24,
  },
  modalContent: {
    flex: 1,
    marginHorizontal: 25,
    marginTop: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  cartItem: {
    fontSize: 16,
  },
  cartActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qtyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  quantityText: {
    marginHorizontal: 8,
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
  },
  checkoutButton: {
    marginTop: 25,
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#999',
  },
});