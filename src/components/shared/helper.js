import React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, Text } from 'react-native';

export const B = props => <Text style={styles.bold}>{props.children}</Text>;
export const I = props => <Text style={styles.italic}>{props.children}</Text>;
export const BI = props => <Text style={[styles.bold, styles.italic]}>{props.children}</Text>;
B.propTypes = I.propTypes = BI.propTypes = {
	children: PropTypes.node
};

const styles = StyleSheet.create({
	bold: { fontWeight: 'bold' },
	italic: { fontStyle: 'italic' }
});